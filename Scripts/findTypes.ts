import { MachOParser } from './MachOParser.js';
import { SegmentCommand64 } from './types.js';

interface SectionRange {
  name: string;
  start: bigint;
  size: number;
  offset: number;
  sectname: string;
  segname: string;
}

export function validTypesForReaper(data: Buffer): string[] {
  const parser = new MachOParser(data);
  parser.parseLoadCommands();
  if (parser.isFatFile) {
    console.log(`Unsupported fat file, only arm64 binaries are supported.`);
    return [];
  }

  parser.parseChainedFixups();
  const ranges = sectionRanges(parser);

  const validSwiftTypes = validSwiftTypesForReaper(parser, ranges);
  const validObjcClasses = validObjcClassesForReaper(parser, ranges);

  return removeNonUniqueElements([...validSwiftTypes, ...validObjcClasses]);
}

function sectionRanges(parser: MachOParser): SectionRange[] {
  const results: SectionRange[] = [];

  for (const lc of parser.parseLoadCommands()) {
    if (
      (lc.name === 'LC_SEGMENT_64' || lc.name === 'LC_SEGMENT') &&
      'filesize' in lc &&
      (lc as SegmentCommand64).filesize > 0
    ) {
      const segLc = lc as SegmentCommand64;
      for (const section of segLc.sections || []) {
        if (section.offset !== 0) {
          results.push({
            name: `${segLc.segname}/${section.sectname}`,
            start: BigInt(section.addr),
            size: Number(section.size),
            offset: section.offset,
            sectname: section.sectname,
            segname: segLc.segname,
          });
        }
      }
    }
  }

  return results;
}

function unpackedTarget(ptr: bigint, parser: MachOParser): number | null {
  if (!parser.usesChainedFixups) {
    return parser.fileOffset(ptr);
  }

  const x = ptr & BigInt('0xFFFFFFFFFFFFFFFF');
  const highBits = ((x >> BigInt(36)) & BigInt(0xff)) << BigInt(56);
  const lowBits = x & BigInt('0x0FFFFFFFFF');
  const unpacked = highBits | lowBits;

  const threshold = BigInt(4000000000);
  if (unpacked > threshold) {
    return parser.fileOffset(unpacked);
  }

  return Number(unpacked);
}

function isTypeAttributable(flags: number): boolean {
  const typeFlags = (flags >> 16) & 0xffff;
  const isGeneric = (flags & 0x80) !== 0;
  const hasSingleton = (typeFlags & 0x3) === 1;
  const hasResilientSuperclass = (typeFlags & 0x1000) !== 0;
  return hasSingleton && !isGeneric && !hasResilientSuperclass;
}

function getName(parser: MachOParser, typeOffset: number): string {
  const buf = parser.bufferWrapper.buffer;

  const flags = buf.readUInt32LE(typeOffset);
  const kind = flags & 0x1f;

  let thisName = '';
  if ([0, 16, 17, 18].includes(kind)) {
    const nameRelativePtr = buf.readInt32LE(typeOffset + 8);
    const strOffset = typeOffset + 8 + nameRelativePtr;
    thisName = parser.readNullTerminated(strOffset);
  }

  if (kind !== 0) {
    const parentOffset = buf.readInt32LE(typeOffset + 4);
    let parentAddress = typeOffset + 4 + parentOffset;
    if (Math.abs(parentOffset) % 2 === 1) {
      const indirectAddress = buf.readBigUInt64LE(typeOffset + 4 + (parentOffset & ~1));
      const actualParent = unpackedTarget(indirectAddress, parser);
      if (actualParent !== null) {
        parentAddress = actualParent;
      }
    }
    const parentName =
      parentAddress >= 0 && parentAddress < parser.bufferWrapper.buffer.length ? getName(parser, parentAddress) : '';

    if (thisName.length === 0) {
      return parentName;
    }
    if (parentName.length > 0) {
      return `${parentName}.${thisName}`;
    }
  }

  return thisName;
}

function demangleName(name: string): string {
  if (!name.startsWith('_TtC')) {
    return name;
  }
  let remaining = name.slice(4);
  const count1 = integerPrefix(remaining);
  if (!count1) {
    return name;
  }
  const mod = remaining.slice(count1.text.length, count1.text.length + count1.value);
  remaining = remaining.slice(count1.text.length + count1.value);

  const count2 = integerPrefix(remaining);
  if (!count2) {
    return name;
  }
  const cls = remaining.slice(count2.text.length, count2.text.length + count2.value);

  return `${mod}.${cls}`;
}

function integerPrefix(str: string): { text: string; value: number } | null {
  const match = str.match(/^([1-9]\d*)/);
  if (!match) {
    return null;
  }
  return { text: match[1], value: parseInt(match[1], 10) };
}

function validSwiftTypesForReaper(parser: MachOParser, ranges: SectionRange[]): string[] {
  const swiftTypesSection = ranges.find((sect) => sect.sectname === '__swift5_types');
  if (!swiftTypesSection) {
    console.log('Could not find __swift5_types section');
    return [];
  }

  const buf = parser.bufferWrapper.buffer;
  const sectionStart = swiftTypesSection.offset;
  const sectionSize = swiftTypesSection.size;
  const swiftTypesData = buf.subarray(sectionStart, sectionStart + sectionSize);

  const numTypes = Math.floor(swiftTypesData.length / 8);

  const validTypes: string[] = [];

  for (let i = 0; i < numTypes; i++) {
    const relativePtrStart = sectionStart + i * 4;
    const relativeOffset = buf.readInt32LE(relativePtrStart);

    const flagsOffset = relativePtrStart + relativeOffset;
    if (flagsOffset < 0 || flagsOffset + 4 > buf.length) {
      continue;
    }
    const flags = buf.readUInt32LE(flagsOffset);
    const kind = flags & 0x1f;

    if (kind === 17 || kind === 18) {
      if (isTypeAttributable(flags)) {
        const typeName = getName(parser, flagsOffset);
        validTypes.push(typeName);
      }
    }
  }

  return validTypes;
}

function validObjcClassesForReaper(parser: MachOParser, ranges: SectionRange[]): string[] {
  const result: string[] = [];
  const buf = parser.bufferWrapper.buffer;

  const classlistSection = ranges.find((sect) => sect.sectname === '__objc_classlist');
  if (!classlistSection) {
    console.log('Could not find __objc_classlist section');
    return [];
  }

  const classlistDataStart = classlistSection.offset;
  const classlistDataSize = classlistSection.size;
  const numClasses = classlistDataSize / 8;

  for (let i = 0; i < numClasses; i++) {
    const ptrOffset = classlistDataStart + i * 8;
    if (ptrOffset + 8 > buf.length) {
      console.warn('Class ptrOffset too large');
      continue;
    }

    const classPtr = buf.readBigUInt64LE(ptrOffset);
    const classFileOffset = unpackedTarget(classPtr, parser);
    if (classFileOffset == null || classFileOffset + 40 > buf.length) {
      console.warn('Class file offset is wrong');
      continue;
    }

    const classData = readFields(parser, classFileOffset, 40, [
      'Q', // isa
      'Q', // superclass
      'Q', // cache
      'L', // mask
      'L', // occupied
      'Q', // taggedData
    ]);
    if (!classData) {
      console.warn('Missing class data');
      continue;
    }
    const [, , , , , taggedData] = classData;

    const dataPtr = BigInt(taggedData) & 0x00007ffffffffff8n;
    const dataFileOffset = unpackedTarget(BigInt(dataPtr), parser);
    if (dataFileOffset == null || dataFileOffset + 32 > buf.length) {
      console.warn('Data file offset is wrong');
      continue;
    }

    const classRoData = readFields(parser, dataFileOffset, 32, [
      'L', // flags
      'L', // instanceStart
      'L', // instanceSize
      'L', // reserved
      'Q', // ivarLayout_ptr
      'Q', // name_ptr
    ]);
    if (!classRoData) {
      console.warn('No class ro data');
      continue;
    }
    const [, , , , , namePtr] = classRoData;

    const nameFileOffset = unpackedTarget(BigInt(namePtr), parser);
    let className = '';
    if (nameFileOffset != null) {
      className = parser.readNullTerminated(nameFileOffset);
    }

    const isSwiftLegacy = (BigInt(taggedData) & 0x1n) !== 0n;
    const isSwiftStable = (BigInt(taggedData) & 0x2n) !== 0n;

    if (!isSwiftLegacy && !isSwiftStable) {
      // It's a normal ObjC class
      result.push(className);
    } else {
      if (classFileOffset + 76 > buf.length) {
        console.warn('Class file offset is too large');
        continue;
      }
      const swiftClassData = readFields(parser, classFileOffset, 76, [
        'Q', // isa
        'Q', // superclass
        'Q', // cache
        'L', // mask
        'L', // occupied
        'Q', // taggedData
        'L', // flags
        'L', // instanceAddressOffset
        'L', // instanceSize
        'S', // instanceAlignMask (2 bytes)
        'S', // reserved (2 bytes)
        'L', // classSize
        'L', // classAddressOffset
        'Q', // description
      ]);
      if (!swiftClassData) {
        console.warn('Could not get swift class data');
        continue;
      }
      const description = swiftClassData[swiftClassData.length - 1];
      if (typeof description !== 'bigint') {
        console.warn('Unexpected type of swift class data');
        continue;
      }

      const descriptionOffset = unpackedTarget(description, parser);
      if (!descriptionOffset || descriptionOffset + 4 > buf.length) {
        console.warn('Could not get offset of swift class data');
        continue;
      }
      const typeFlags = buf.readUInt32LE(descriptionOffset);
      const highBits = (typeFlags >> 16) & 0xffff;
      const hasSingleton = (highBits & 0x3) === 1;
      if (hasSingleton) {
        const hasResilientSuperclass = (highBits & 0x1000) !== 0;
        if (!hasResilientSuperclass) {
          result.push(demangleName(className));
        }
      } else {
        result.push(demangleName(className));
      }
    }
  }

  return result;
}

function readFields(
  parser: MachOParser,
  offset: number,
  size: number,
  format: Array<'Q' | 'L' | 'S'>,
): Array<number | bigint> | null {
  if (offset < 0 || offset + size > parser.bufferWrapper.buffer.length) {
    return null;
  }
  let cursor = offset;
  const out: Array<number | bigint> = [];
  for (const f of format) {
    switch (f) {
      case 'Q': {
        const val = parser.bufferWrapper.buffer.readBigUInt64LE(cursor);
        out.push(val);
        cursor += 8;
        break;
      }
      case 'L': {
        const val = parser.bufferWrapper.buffer.readUInt32LE(cursor);
        out.push(val);
        cursor += 4;
        break;
      }
      case 'S': {
        const val = parser.bufferWrapper.buffer.readUInt16LE(cursor);
        out.push(val);
        cursor += 2;
        break;
      }
      default:
        return null; // Unknown format code
    }
  }
  return out;
}

function removeNonUniqueElements(array: string[]): string[] {
  return Array.from(new Set(array));
}
