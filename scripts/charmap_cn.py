#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
charmap_cn.py
	Build-time converter that lets C tables embed text (e.g. Chinese item names)
	directly as CN("中文") literals, expanded to charmap byte arrays before gcc runs.

	In a .c file write:
		.name = CN("大师球"),
	Before compiling, build.py expands it in a generated copy to:
		.name = { 0x02, 0xD3, 0x0B, 0xE2, 0x0B, 0x14, 0xFF},
	The source file itself is never modified and stays editable as plain text.

	One-off reverse migration (hex entries -> CN literals):
		python scripts/charmap_cn.py --migrate src/Tables/item_tables.c
	A line is only replaced when re-encoding the decoded text reproduces the
	original bytes exactly, so migration is lossless.

	Bulk-translate English `_X` token names from a dictionary spreadsheet:
		python scripts/charmap_cn.py --apply-xlsx 道具名称_英-中.xlsx src/Tables/item_tables.c [maxBytes]
	Reads EN->CN pairs from columns A/B (data after the 原文 header row),
	decodes each token-style `.name = { _X, ... _END }` back to English,
	matches case- and accent-insensitively, and rewrites hits as CN("译文").
	Names whose translation exceeds maxBytes (default 14, the u8 name[] size)
	are skipped and reported, never truncated. Token codes come from
	include/easy_text.h, so new punctuation tokens need no script changes.

	Byte emission matches scripts/string.py ProcessString: codes <= 0xFF are one
	byte, larger codes are two bytes big-endian, and 0xFF (_END) terminates.
"""

import os
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

CharMap = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "charmap.tbl")
STRING_TERMINATOR = 0xFF

_charMapCache = None


def LoadCharMap():
	"""Parse charmap.tbl ("code=char") into a char -> code dict. Cached."""
	global _charMapCache
	if _charMapCache is not None:
		return _charMapCache

	dictionary = {}
	with open(CharMap, "r", encoding="utf-8-sig") as file:
		for line in file:
			line = line.rstrip("\r\n")
			if line.strip() == "" or line.strip() == "/FF":
				continue
			if "=" not in line:
				continue
			codeText, _, char = line.partition("=")
			try:
				code = int(codeText, 16)
			except ValueError:
				continue
			# Keep single chars and 2-char escapes like "\e"; skip anything else
			if len(char) == 1 or (len(char) == 2 and char[0] == "\\"):
				dictionary[char] = code
	dictionary[" "] = 0
	_charMapCache = dictionary
	return dictionary


def EncodeToBytes(text, totalLength=None, context=""):
	"""Convert text to charmap bytes + 0xFF terminator.

	With totalLength, pad with 0xFF up to that many bytes (like FILL_FF in
	.string files). Raise on unknown chars or when exceeding totalLength.
	"""
	charMap = LoadCharMap()
	bytes_ = []
	for index, char in enumerate(text):
		if char not in charMap:
			raise ValueError(
				'Character "%s" (U+%04X) at position %d is not in charmap.tbl%s'
				% (char, ord(char), index, " in " + context if context else "")
			)
		code = charMap[char]
		if code <= 0xFF:
			bytes_.append(code)
		else:
			bytes_.append((code >> 8) & 0xFF)
			bytes_.append(code & 0xFF)
	bytes_.append(STRING_TERMINATOR)
	if totalLength is not None:
		if len(bytes_) > totalLength:
			raise ValueError(
				'String needs %d bytes (with terminator) but the fill length is %d%s'
				% (len(bytes_), totalLength, " in " + context if context else "")
			)
		bytes_ += [STRING_TERMINATOR] * (totalLength - len(bytes_))
	return bytes_


_CNLiteralRegex = re.compile(r'CN\("((?:[^"\\\n]|\\.)*)"(?:\s*,\s*(\d+))?\)')


def _Unescape(text):
	return text.replace('\\"', '"').replace("\\\\", "\\")


def _Escape(text):
	return text.replace("\\", "\\\\").replace('"', '\\"')


def ExpandCNText(text, sourceName=""):
	"""Expand every CN("...") literal in the text to a { 0x.., ...} byte array."""
	lines = text.splitlines(True)
	outLines = []
	for lineNum, line in enumerate(lines, 1):
		if "CN(" not in line:
			outLines.append(line)
			continue

		def replaceMatch(match):
			textInside = _Unescape(match.group(1))
			fillLength = int(match.group(2)) if match.group(2) else None
			try:
				bytes_ = EncodeToBytes(textInside, fillLength)
			except ValueError as error:
				raise ValueError("%s, line %d: %s" % (sourceName, lineNum, error))
			return "{ " + ", ".join("0x%02X" % byte for byte in bytes_) + "}"

		try:
			outLines.append(_CNLiteralRegex.sub(replaceMatch, line))
		except ValueError as error:
			print("Error! " + str(error))
			sys.exit(1)
	return "".join(outLines)


# Quoted relative #include lines, e.g. #include "../defines.h"
_IncludeRegex = re.compile(r'^(\s*#include\s*")([^"]+)(")', re.MULTILINE)


def ExpandCNInFile(cFile):
	"""Return a build/-path of a gcc-compilable copy with CN() expanded.

	Returns None when the file contains no CN() literals (caller compiles the
	original). The generated copy keeps identical line numbers, so compiler
	errors map 1:1 onto the source file.
	"""
	with open(cFile, "rb") as file:
		raw = file.read()

	if b"CN(" not in raw:
		return None

	# Only files with CN() literals are decoded; they contain Chinese text and
	# are always UTF-8, so other encodings elsewhere in the repo stay untouched.
	text = raw.decode("utf-8")
	expanded = ExpandCNText(text, cFile)

	# Point quoted relative includes at absolute paths so the copy compiles
	# from build/ even though it is not next to the original.
	cFileDir = os.path.dirname(os.path.abspath(cFile))

	def rewriteInclude(match):
		include = match.group(2)
		if not os.path.isabs(include):
			include = os.path.abspath(os.path.normpath(os.path.join(cFileDir, include)))
		return match.group(1) + include.replace("\\", "/") + match.group(3)

	expanded = _IncludeRegex.sub(rewriteInclude, expanded)

	buildDir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "build")
	os.makedirs(buildDir, exist_ok=True)
	import hashlib

	m = hashlib.md5()
	m.update(os.path.abspath(cFile).encode())
	base = os.path.basename(cFile)
	genFile = os.path.join(buildDir, m.hexdigest()[:8] + "_" + base.replace(".c", ".gen.c"))
	with open(genFile, "wb") as file:
		file.write(expanded.encode("utf-8"))
	return genFile


# ---------------- Reverse migration ----------------

_NameFieldRegex = re.compile(r"\.name\s*=\s*\{([^}\n]*)\}")
_HexTokenRegex = re.compile(r"^0[xX][0-9A-Fa-f]{1,2}$")


def _BuildReverseMap():
	reverse = {}
	for char, code in LoadCharMap().items():
		reverse.setdefault(code, char)
	return reverse


def _DecodeBytes(bytes_, reverse):
	"""Greedy decode: 2-byte big-endian codes first, then 1-byte codes.

	Returns (text, bytesConsumed) or None when a byte is undecodable.
	"""
	text = []
	index = 0
	while index < len(bytes_):
		if bytes_[index] == STRING_TERMINATOR:
			return "".join(text), index
		if index + 1 < len(bytes_):
			code = (bytes_[index] << 8) | bytes_[index + 1]
			if code in reverse:
				text.append(reverse[code])
				index += 2
				continue
		if bytes_[index] in reverse:
			text.append(reverse[bytes_[index]])
			index += 1
			continue
		return None
	return "".join(text), index


def MigrateFile(path):
	"""Rewrite `.name = { hex... }` entries into CN("...") literals (lossless)."""
	reverse = _BuildReverseMap()

	with open(path, "r", encoding="utf-8", newline="") as file:
		text = file.read()

	migrated = 0
	skipped = []

	def replaceMatch(match):
		nonlocal migrated
		body = match.group(1)
		tokens = [token.strip() for token in body.split(",") if token.strip()]
		if not tokens or not all(_HexTokenRegex.match(token) for token in tokens):
			skipped.append("non-hex tokens")
			return match.group(0)
		bytes_ = [int(token, 16) for token in tokens]
		decoded = _DecodeBytes(bytes_, reverse)
		if decoded is None:
			skipped.append("undecodable byte")
			return match.group(0)
		decodedText, consumed = decoded
		# Bytes after the terminator must be uniform 0x00 (C zero-fill) or
		# uniform 0xFF (FILL_FF style); anything else cannot be expressed.
		trailing = bytes_[consumed + 1:]
		fillLength = len(bytes_) if trailing and all(byte == 0xFF for byte in trailing) else None
		if trailing and not fillLength:
			skipped.append("mixed trailing bytes")
			return match.group(0)
		# Lossless check: re-encoding must reproduce the exact byte stream
		try:
			reencoded = EncodeToBytes(decodedText, fillLength)
		except ValueError:
			reencoded = None
		if reencoded != bytes_:
			skipped.append("round-trip mismatch")
			return match.group(0)
		migrated += 1
		literal = 'CN("' + _Escape(decodedText) + '"'
		if fillLength is not None:
			literal += ", %d" % fillLength
		literal += ")"
		return ".name = " + literal

	newText = _NameFieldRegex.sub(replaceMatch, text)

	if migrated == 0 and not skipped:
		print("No hex .name entries found to migrate in " + path)
		return

	if newText != text:
		with open(path, "w", encoding="utf-8", newline="") as file:
			file.write(newText)

	print('Migrated %d .name entries to CN("...") in %s' % (migrated, path))
	print("Entries left as-is: %d (English _X tokens, placeholders, or undecodable)" % len(skipped))


# ---------------- xlsx dictionary application ----------------

_XlsxNamespace = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_DefineRegex = re.compile(r"^#define\s+(_\w+)\s+0x([0-9A-Fa-f]+)\s*(?:$|//)")


def _NormalizeKey(text):
	"""Casefold + strip accents so 'Pokè Doll', 'Poké Doll' and 'poke doll' match."""
	decomposed = unicodedata.normalize("NFKD", text)
	stripped = "".join(char for char in decomposed if not unicodedata.combining(char))
	return " ".join(stripped.casefold().split())


def _LoadXlsxDictionary(xlsxPath):
	"""Parse EN->CN pairs from columns A/B, data rows after the 原文 header row."""
	with zipfile.ZipFile(xlsxPath) as archive:
		shared = []
		if "xl/sharedStrings.xml" in archive.namelist():
			root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
			for item in root.findall(_XlsxNamespace + "si"):
				shared.append("".join(node.text or "" for node in item.iter(_XlsxNamespace + "t")))
		sheetName = sorted(
			name for name in archive.namelist()
			if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
		)[0]
		root = ET.fromstring(archive.read(sheetName))

	pairs = []
	headerSeen = False
	for row in root.iter(_XlsxNamespace + "row"):
		cells = {}
		for cell in row.findall(_XlsxNamespace + "c"):
			column = "".join(char for char in cell.get("r", "") if char.isalpha()).upper()
			cellType = cell.get("t")
			valueNode = cell.find(_XlsxNamespace + "v")
			if cellType == "s" and valueNode is not None:
				value = shared[int(valueNode.text)]
			elif cellType == "inlineStr":
				inline = cell.find(_XlsxNamespace + "is")
				value = "".join(node.text or "" for node in inline.iter(_XlsxNamespace + "t")) if inline is not None else ""
			elif valueNode is not None and valueNode.text is not None:
				value = valueNode.text
			else:
				value = ""
			cells[column] = value.strip()
		english = cells.get("A", "")
		chinese = cells.get("B", "")
		if not headerSeen:
			if english == "原文":
				headerSeen = True
			continue
		if english and chinese:
			pairs.append((english, chinese))

	dictionary = {}
	duplicates = []
	for english, chinese in pairs:
		key = _NormalizeKey(english)
		if key in dictionary and dictionary[key] != chinese:
			duplicates.append((english, chinese))
		dictionary[key] = chinese  # later rows win
	return dictionary, duplicates, len(pairs)


def _LoadTokenMap(headerPath):
	"""Parse `#define _X 0xYY` from the text header, resolve chars via charmap."""
	reverse = _BuildReverseMap()
	tokens = {}
	with open(headerPath, "r", encoding="utf-8-sig") as file:
		for line in file:
			match = _DefineRegex.match(line.strip())
			if match is None:
				continue
			name, codeText = match.groups()
			code = int(codeText, 16)
			if code in reverse:
				tokens[name] = reverse[code]
	return tokens


def ApplyXlsx(xlsxPath, cFilePath, maxBytes):
	dictionary, duplicates, pairCount = _LoadXlsxDictionary(xlsxPath)
	print('Loaded %d EN->CN pairs from "%s" (%d duplicate keys, later rows win)'
		  % (pairCount, xlsxPath, len(duplicates)))
	for english, chinese in duplicates:
		print('  duplicate: "%s" -> "%s" (overridden by a later row)' % (english, chinese))

	headerPath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "include", "easy_text.h")
	tokens = _LoadTokenMap(headerPath)
	if len(tokens) == 0:
		print("Error! No _X token defines found in " + headerPath)
		sys.exit(1)

	with open(cFilePath, "rb") as file:
		text = file.read().decode("utf-8")

	replaced = 0
	tooLong = []
	unmatched = []
	unknownToken = set()

	def replaceMatch(match):
		nonlocal replaced
		body = match.group(1)
		tokenNames = [token.strip() for token in body.split(",") if token.strip()]
		if any("0x" in token.lower() for token in tokenNames):
			return match.group(0)  # hex-style entries are not this mode's business
		english = ""
		for name in tokenNames:
			if name == "_END":
				break
			if name not in tokens:
				unknownToken.add(name)
				return match.group(0)
			english += tokens[name]
		if not english:
			return match.group(0)
		chinese = dictionary.get(_NormalizeKey(english))
		if chinese is None:
			unmatched.append(english)
			return match.group(0)
		try:
			needed = len(EncodeToBytes(chinese))
		except ValueError as error:
			tooLong.append((english, chinese, str(error)))
			return match.group(0)
		if needed > maxBytes:
			tooLong.append((english, chinese, "%d bytes > %d" % (needed, maxBytes)))
			return match.group(0)
		replaced += 1
		return '.name = CN("' + _Escape(chinese) + '")'

	newText = _NameFieldRegex.sub(replaceMatch, text)

	if replaced:
		with open(cFilePath, "wb") as file:
			file.write(newText.encode("utf-8"))

	print('Applied xlsx: %d names replaced in %s' % (replaced, cFilePath))
	if tooLong:
		print("Skipped, translation too long for %d bytes:" % maxBytes)
		for english, chinese, reason in tooLong:
			print('  "%s" -> "%s" (%s)' % (english, chinese, reason))
	if unmatched:
		print("No dictionary entry found for %d names (left as English):" % len(unmatched))
		for english in unmatched:
			print('  "%s"' % english)
	if unknownToken:
		print("Unknown tokens skipped: " + ", ".join(sorted(unknownToken)))


if __name__ == "__main__":
	if len(sys.argv) == 3 and sys.argv[1] == "--migrate":
		MigrateFile(sys.argv[2])
	elif len(sys.argv) == 3 and sys.argv[1] == "--encode":
		bytes_ = EncodeToBytes(sys.argv[2])
		print("{ " + ", ".join("0x%02X" % byte for byte in bytes_) + "}")
	elif len(sys.argv) in (4, 5) and sys.argv[1] == "--apply-xlsx":
		maxBytes = int(sys.argv[4]) if len(sys.argv) == 5 else 14
		ApplyXlsx(sys.argv[2], sys.argv[3], maxBytes)
	else:
		print("Usage:")
		print('  python scripts/charmap_cn.py --encode "大师球"')
		print("  python scripts/charmap_cn.py --migrate src/Tables/item_tables.c")
		print("  python scripts/charmap_cn.py --apply-xlsx 道具名称_英-中.xlsx src/Tables/item_tables.c [maxBytes]")
