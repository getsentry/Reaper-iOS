export class BufferWrapper {
  buffer: Buffer;

  cursor: number;

  debug: boolean;

  constructor(buffer: Buffer, debug: boolean = false) {
    this.buffer = buffer;
    this.cursor = 0;
    this.debug = false;
  }

  seek(offset: number) {
    this.cursor = offset;
  }

  skip(length: number) {
    this.cursor += length;
  }

  readU8() {
    this.logGroup('readU8');
    this.logDebug(`cursor: ${this.cursor}`);

    const val = this.buffer[this.cursor];
    this.logDebug(`value: ${val}`);

    this.cursor += 1;

    this.logGroupEnd();
    return val;
  }

  readS8() {
    this.logGroup('readS8');
    this.logDebug(`cursor: ${this.cursor}`);

    const val = this.buffer.readInt8(this.cursor);
    this.logDebug(`value: ${val}`);

    this.cursor += 1;

    this.logGroupEnd();
    return val;
  }

  readU16() {
    this.logGroup('readU16');
    this.logDebug(`cursor: ${this.cursor}`);

    const val = this.buffer.readUInt16LE(this.cursor);
    this.logDebug(`value: ${val}`);

    this.cursor += 2;

    this.logGroupEnd();
    return val;
  }

  readS32() {
    this.logGroup('readS32');
    this.logDebug(`cursor: ${this.cursor}`);

    const val = this.buffer.readInt32LE(this.cursor);
    this.logDebug(`value: ${val}`);

    this.cursor += 4;

    this.logGroupEnd();
    return val;
  }

  readU32(): number {
    this.logGroup('readU32');
    this.logDebug(`cursor: ${this.cursor}`);

    const val = this.buffer.readUInt32LE(this.cursor);
    this.logDebug(`value: ${val} 0x${val.toString(16)}`);

    this.cursor += 4;

    this.logGroupEnd();
    return val;
  }

  readU32BE(): number {
    this.logGroup('readU32BE');
    this.logDebug(`cursor: ${this.cursor}`);

    const val = this.buffer.readUInt32BE(this.cursor);
    this.logDebug(`value: ${val} 0x${val.toString(16)}`);

    this.cursor += 4;

    this.logGroupEnd();
    return val;
  }

  readU64(): bigint {
    this.logGroup('readU64');
    this.logDebug(`cursor: ${this.cursor}`);

    const low = this.buffer.readUInt32LE(this.cursor);
    const high = this.buffer.readUInt32LE(this.cursor + 4);
    const val = (BigInt(high) << 32n) | BigInt(low);
    this.logDebug(`value: ${val} 0x${val.toString(16)}`);

    this.cursor += 8;

    this.logGroupEnd();
    return val;
  }

  readLength8() {
    this.logGroup('readLength8');
    let len = this.readU8();
    if (len & 0x80) {
      len = (len & 0x7f) << 8;
      len += this.readU8();
    }

    this.logDebug(`length: ${len}`);
    this.logGroupEnd();
    return len;
  }

  readLength16() {
    this.logGroup('readLength16');
    let len = this.readU16();
    if (len & 0x8000) {
      len = (len & 0x7fff) << 16;
      len += this.readU16();
    }

    this.logDebug(`length: ${len}`);
    this.logGroupEnd();
    return len;
  }

  // Unsigned Little Endian Base 128
  // Each byte has 7 bits allocated for data and 1 bit (the most significant bit, MSB) used as a continuation flag
  // The data bits (7 bits per byte) are concatenated to reconstruct the integer, with the least significant bits coming first (little-endian order)
  readUleb128(): number {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.readU8();
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte >= 0x80);
    return result;
  }

  readUleb128Bigint(): bigint {
    let result = BigInt(0);
    let shift = 0;
    let byte;
    do {
      byte = this.readU8();
      result |= BigInt(byte & 0x7f) << BigInt(shift);
      shift += 7;
    } while (byte >= 0x80);
    return result;
  }

  // TODO(telkins)
  readLeb128(): number {
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.buffer[this.cursor++];
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return result;
  }

  readSizedInt(size: number): number {
    this.logGroup(`readSizedInt (${size} bytes)`);
    const cursor = this.cursor;
    let result: number;

    switch (size) {
      case 4:
        result =
          (this.buffer[cursor] & 0xff) |
          ((this.buffer[cursor + 1] & 0xff) << 8) |
          ((this.buffer[cursor + 2] & 0xff) << 16) |
          (this.buffer[cursor + 3] << 24);
        break;
      case 3:
        result =
          (this.buffer[cursor] & 0xff) | ((this.buffer[cursor + 1] & 0xff) << 8) | (this.buffer[cursor + 2] << 16);
        if (result & 0x800000) {
          result |= 0xff000000;
        }
        break;
      case 2:
        result = (this.buffer[cursor] & 0xff) | (this.buffer[cursor + 1] << 8);
        if (result & 0x8000) {
          result |= 0xffff0000;
        }
        break;
      case 1:
        result = this.buffer[cursor];
        if (result & 0x80) {
          result |= 0xffffff00;
        }
        break;
      default:
        throw new Error(`Invalid size ${size} for sized int at offset 0x${cursor.toString(16)}`);
    }

    this.cursor = cursor + size;
    this.logGroupEnd();
    return result;
  }

  readSizedUInt(size: number): number {
    this.logGroup(`readSizedUInt (${size} bytes)`);
    const cursor = this.cursor;
    let result: number;

    switch (size) {
      case 4:
        result =
          (this.buffer[cursor] & 0xff) |
          ((this.buffer[cursor + 1] & 0xff) << 8) |
          ((this.buffer[cursor + 2] & 0xff) << 16) |
          ((this.buffer[cursor + 3] & 0xff) << 24);
        break;
      case 3:
        result =
          (this.buffer[cursor] & 0xff) |
          ((this.buffer[cursor + 1] & 0xff) << 8) |
          ((this.buffer[cursor + 2] & 0xff) << 16);
        break;
      case 2:
        result = (this.buffer[cursor] & 0xff) | ((this.buffer[cursor + 1] & 0xff) << 8);
        break;
      case 1:
        result = this.buffer[cursor] & 0xff;
        break;
      default:
        throw new Error(`Invalid size ${size} for sized int at offset 0x${cursor.toString(16)}`);
    }

    this.cursor = cursor + size;
    this.logGroupEnd();
    return result >>> 0;
  }

  readSizedLong(size: number): bigint {
    this.logGroup(`readSizedLong (${size} bytes)`);
    let result = BigInt(0);
    if (size < 1 || size > 8) {
      throw new Error(`Invalid size ${size} for sized long at offset 0x${this.cursor.toString(16)}`);
    }

    // Reading bytes from the buffer and constructing the long (bigint)
    for (let i = 0; i < size; i++) {
      result |= BigInt(this.buffer[this.cursor + i]) << (BigInt(i) * BigInt(8));
    }

    this.cursor += size;
    this.logDebug(`Read Sized Long: ${result}`);
    this.logGroupEnd();
    return result;
  }

  readSizedFloat(size: number): number {
    this.logGroup(`readSizedFloat (${size} bytes)`);
    const bytes = Buffer.alloc(4);

    // zero extend tot the right
    this.buffer.copy(bytes, 4 - size, this.cursor, (this.cursor += size));

    this.logGroupEnd();
    return bytes.readFloatLE(0);
  }

  readSizedDouble(size: number): number {
    this.logGroup(`readSizedDouble (${size} bytes)`);
    const bytes = Buffer.alloc(8);

    // zero extend tot the right
    this.buffer.copy(bytes, 8 - size, this.cursor, (this.cursor += size));

    this.logGroupEnd();
    return bytes.readDoubleLE(0);
  }

  readStringWithLength(length: number): string {
    this.logGroup(`readString (${length} bytes)`);
    const str = this.buffer.toString('utf8', this.cursor, this.cursor + length).replace(/\0/g, '');
    this.cursor += length;
    this.logGroupEnd();
    return str;
  }

  readStringNullTerminated(): string {
    let end = this.cursor;
    while (this.buffer[end] !== 0) end++;
    const str = this.buffer.toString('utf8', this.cursor, end);
    this.cursor = end + 1;
    return str;
  }

  maybeReadStringNullTerminated(): string | null {
    const str = this.readStringNullTerminated();
    return str.length === 0 || str === '\u0001' ? null : str;
  }

  slice(length: number): Buffer {
    const result = this.buffer.slice(this.cursor, this.cursor + length);
    this.cursor += length;
    return result;
  }

  alignBuffer(alignment: number = 4): void {
    const currentPos = this.cursor;
    if (currentPos % alignment !== 0) {
      this.skip(alignment - (currentPos % alignment));
    }
  }

  logGroup(name: string) {
    if (this.debug) console.group(name);
  }

  logGroupEnd() {
    if (this.debug) console.groupEnd();
  }

  logDebug(message: string) {
    if (this.debug) console.debug(message);
  }
}
