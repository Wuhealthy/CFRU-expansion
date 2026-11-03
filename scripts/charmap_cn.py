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

	Byte emission matches scripts/string.py ProcessString: codes <= 0xFF are one
	byte, larger codes are two bytes big-endian, and 0xFF (_END) terminates.
"""

import os
import re
import sys

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


if __name__ == "__main__":
	if len(sys.argv) == 3 and sys.argv[1] == "--migrate":
		MigrateFile(sys.argv[2])
	elif len(sys.argv) == 3 and sys.argv[1] == "--encode":
		bytes_ = EncodeToBytes(sys.argv[2])
		print("{ " + ", ".join("0x%02X" % byte for byte in bytes_) + "}")
	else:
		print("Usage:")
		print('  python scripts/charmap_cn.py --encode "大师球"')
		print("  python scripts/charmap_cn.py --migrate src/Tables/item_tables.c")
