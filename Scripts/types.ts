export interface MachO64Header {
  magic: number;
  cputype: number;
  cpusubtype: number;
  filetype: number;
  ncmds: number;
  sizeofcmds: number;
  flags: number;
  reserved: number;
}

export interface LoadCommand {
  cmd: number;
  name: string;
  cmdSize: number;
  offset: number;
  uuid?: string;
}

export interface BoundSymbol {
  segmentOffset: number;
  library: number;
  offset: number;
  symbol: string;
}

export const LC_REQ_DYLD = 0x80000000;

export enum LoadCommands {
  LC_SEGMENT = 0x1,
  LC_SYMTAB = 0x2,
  LC_SYMSEG = 0x3,
  LC_THREAD = 0x4,
  LC_UNIXTHREAD = 0x5,
  LC_LOADFVMLIB = 0x6,
  LC_IDFVMLIB = 0x7,
  LC_IDENT = 0x8,
  LC_FVMFILE = 0x9,
  LC_PREPAGE = 0xa,
  LC_DYSYMTAB = 0xb,
  LC_LOAD_DYLIB = 0xc,
  LC_ID_DYLIB = 0xd,
  LC_LOAD_DYLINKER = 0xe,
  LC_ID_DYLINKER = 0xf,
  LC_PREBOUND_DYLIB = 0x10,
  LC_ROUTINES = 0x11,
  LC_SUB_FRAMEWORK = 0x12,
  LC_SUB_UMBRELLA = 0x13,
  LC_SUB_CLIENT = 0x14,
  LC_SUB_LIBRARY = 0x15,
  LC_TWOLEVEL_HINTS = 0x16,
  LC_PREBIND_CKSUM = 0x17,
  LC_LOAD_WEAK_DYLIB = 0x18 | LC_REQ_DYLD,
  LC_SEGMENT_64 = 0x19,
  LC_ROUTINES_64 = 0x1a,
  LC_UUID = 0x1b,
  LC_RPATH = 0x1c | LC_REQ_DYLD,
  LC_CODE_SIGNATURE = 0x1d,
  LC_SEGMENT_SPLIT_INFO = 0x1e,
  LC_REEXPORT_DYLIB = 0x1f | LC_REQ_DYLD,
  LC_LAZY_LOAD_DYLIB = 0x20,
  LC_ENCRYPTION_INFO = 0x21,
  LC_DYLD_INFO = 0x22,
  LC_DYLD_INFO_ONLY = 0x22 | LC_REQ_DYLD,
  LC_LOAD_UPWARD_DYLIB = 0x23 | LC_REQ_DYLD,
  LC_VERSION_MIN_MACOSX = 0x24,
  LC_VERSION_MIN_IPHONEOS = 0x25,
  LC_FUNCTION_STARTS = 0x26,
  LC_DYLD_ENVIRONMENT = 0x27,
  LC_MAIN = 0x28 | LC_REQ_DYLD,
  LC_DATA_IN_CODE = 0x29,
  LC_SOURCE_VERSION = 0x2a,
  LC_DYLIB_CODE_SIGN_DRS = 0x2b,
  LC_ENCRYPTION_INFO_64 = 0x2c,
  LC_LINKER_OPTION = 0x2d,
  LC_LINKER_OPTIMIZATION_HINT = 0x2e,
  LC_VERSION_MIN_TVOS = 0x2f,
  LC_VERSION_MIN_WATCHOS = 0x30,
  LC_NOTE = 0x31,
  LC_BUILD_VERSION = 0x32,
  LC_DYLD_EXPORTS_TRIE = 0x33 | LC_REQ_DYLD,
  LC_DYLD_CHAINED_FIXUPS = 0x34 | LC_REQ_DYLD,
}

export interface SegmentCommand64 extends LoadCommand {
  // Segment name
  segname: string;
  // Memory address of this segment
  vmaddr: bigint;
  // Memory size of this segment
  vmsize: bigint;
  // File offset of this segment
  fileoff: bigint;
  // Amount to map from the file
  filesize: bigint;
  // Maximum VM protection
  maxprot: number;
  // Initial VM protection
  initprot: number;
  // Number of sections in segment
  nsects: number;
  // Flags
  flags: number;
  // Sections
  sections?: MachOSection64[];
}

export interface MachOSection64 {
  sectname: string;
  segname: string;
  addr: bigint;
  size: bigint;
  offset: number;
  align: number;
  reloff: number;
  nreloc: number;
  flags: number;
  reserved1: number;
  reserved2: number;
  reserved3?: number;
}

export interface ProtocolConformanceDescriptor {
  protocolDescriptor: bigint;
  nominalTypeDescriptor: number;
  protocolWitnessTable: number;
  conformanceFlags: number;
}

export enum TypeReferenceKind {
  DirectTypeDescriptor = 0,
  IndirectTypeDescriptor = 1,
  DirectObjCClassName = 2,
  IndirectObjCClass = 3,
}
// Add possible values for TypeReferenceKind here

// TODO
export class ConformanceFlags {
  private static TypeMetadataKindShift: number = 3;

  private static NumConditionalRequirementsShift: number = 8;

  private static TypeMetadataKindMask: number;

  private static IsRetroactiveMask: number;

  private static NumConditionalRequirementsMask: number;

  private static HasResilientWitnessesMask: number;

  private static HasGenericWitnessTableMask: number;

  private rawFlags: number;

  constructor(rawFlags: number) {
    this.rawFlags = rawFlags;
  }

  get kind(): TypeReferenceKind | null {
    const rawKind = (this.rawFlags & ConformanceFlags.TypeMetadataKindMask) >> ConformanceFlags.TypeMetadataKindShift;
    if (rawKind in TypeReferenceKind) {
      return rawKind as TypeReferenceKind;
    }
    return null;
  }

  get numConditionalRequirements(): number {
    return (
      (this.rawFlags & ConformanceFlags.NumConditionalRequirementsMask) >>
      ConformanceFlags.NumConditionalRequirementsShift
    );
  }

  get isRetroactive(): boolean {
    return (this.rawFlags & ConformanceFlags.IsRetroactiveMask) !== 0;
  }

  get hasResilientWitnesses(): boolean {
    return (this.rawFlags & ConformanceFlags.HasResilientWitnessesMask) !== 0;
  }

  get hasGenericWitnessTable(): boolean {
    return (this.rawFlags & ConformanceFlags.HasGenericWitnessTableMask) !== 0;
  }

  static {
    this.TypeMetadataKindMask = 0x7 << this.TypeMetadataKindShift;
    this.IsRetroactiveMask = 0x01 << 6;
    this.NumConditionalRequirementsMask = 0xff << this.NumConditionalRequirementsShift;
    this.HasResilientWitnessesMask = 0x01 << 16;
    this.HasGenericWitnessTableMask = 0x01 << 17;
  }
}
