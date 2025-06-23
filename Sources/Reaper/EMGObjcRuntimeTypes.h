// Definitions are taken from objc-runtime-new.h

#import <atomic>

typedef uint32_t mask_t;

struct cache_t {
private:
    std::atomic<uintptr_t> _bucketsAndMaybeMask;
    union {
        struct {
            std::atomic<mask_t>    _maybeMask;
#if __LP64__
            uint16_t                   _flags;
#endif
            uint16_t                   _occupied;
        };
        std::atomic<void *> _originalPreoptCache;
    };
};

struct class_rw_t {
    // Be warned that Symbolication knows the layout of this structure.
    uint32_t flags;
    uint16_t witness;
};

struct class_data_bits_t {
    friend objc_class;

    // Values are the FAST_ flags above.
    uintptr_t bits;

    bool getBit(uintptr_t bit) {
      return bits & bit;
    }

// #define FAST_DATA_MASK        0xfffffffcUL
#define FAST_DATA_MASK          0x00007ffffffffff8UL

    class_rw_t* data() const {
        return (class_rw_t *)(bits & FAST_DATA_MASK);
    }
};

struct objc_class : objc_object {
    // Class ISA;
    Class superclass;
    cache_t cache;             // formerly cache pointer and vtable
    class_data_bits_t bits;    // class_rw_t * plus custom rr/alloc flags

  bool is_swift() {
    return bits.getBit(1UL<<0) || bits.getBit(1UL<<1);
  }

  // Only call this when the class is already known to be initialized
  // For some Swift classes just using this method causes
  // it to be initialized.
  const char* name() {
    Class cls = (__bridge Class) this;
    return class_getName(cls);
  }
};

struct swift_class_t : objc_class {
    uint32_t flags;
    uint32_t instanceAddressOffset;
    uint32_t instanceSize;
    uint16_t instanceAlignMask;
    uint16_t reserved;

    uint32_t classSize;
    uint32_t classAddressOffset;
    void *description;
    // ...

    void *baseAddress() {
        return (void *)((uint8_t *)this - classAddressOffset);
    }
};

struct ContextDescriptorFlags {

  uint8_t kind() {
    return rawFlags & 0x1F;
  }

  bool is_generic() {
    return (rawFlags & 0x80) != 0;
  }

  uint16_t type_flags() {
    return (rawFlags >> 16) & 0xFFFF;
  }

  bool has_resilient_superclass() {
    return (type_flags() & 0x1000) != 0;
  }

  bool has_foreign_metadata_initialization() {
    return (type_flags() & 0x3) == 2;
  }

  bool has_singleton_metadata_initialization() {
    return (type_flags() & 0x3) == 1;
  }

  uint32_t rawFlags;
};

struct swift_type {
  ContextDescriptorFlags flags;
  int32_t parent;
  int32_t name;
  int32_t accessFunction;
};

struct swift_class_descriptor {
  struct swift_type swift_data;
  int32_t fieldDescriptor;
  int32_t superclassType;
  uint32_t metadataNegativeSizeInWords;
  uint32_t metadataPositiveSizeInWords;
  uint32_t numImmediateMembers;
  uint32_t numFields;
  uint32_t fieldOffsetVectorOffset;
};

struct swift_struct_descriptor {
  struct swift_type swift_data;
  int32_t fieldDescriptor;
  uint32_t numFields;
  uint32_t fieldOffsetVectorOffset;
};

struct swift_enum_descriptor {
  struct swift_type swift_data;
  int32_t fieldDescriptor;
  uint32_t numPayloadCasesAndPayloadSizeOffset;
  uint32_t numEmptyCases;
};

struct target_singleton_metadata_initialization {
  int32_t initialization_cache;
  int32_t incomplete_metadata_or_resilient_pattern;
  int32_t completion_function;
};
