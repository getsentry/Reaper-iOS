//
//  NameFinder.swift
//  Reaper
//
//  Created by Noah Martin on 11/13/24.
//

import Foundation

@_silgen_name("swift_getTypeName")
public func _getTypeName(_ type: uintptr_t, qualified: Bool)
  -> (UnsafePointer<UInt8>, Int)

@objc(NameFinder)
public final class NameFinder: NSObject {
  @objc public static func getName(ptr: uintptr_t, qualified: Bool) -> String? {
    let (s, length) = _getTypeName(ptr, qualified: qualified)
    let buffer = UnsafeBufferPointer(start: s, count: length)
    return String(bytes: buffer, encoding: .utf8)
  }
}
