#!/usr/bin/env swift
// Generates tinted app icon variants for dev (blue) and staging (orange) builds.
// Applies a color tint overlay to the light background areas, then adds a text
// banner. The source icon is monochrome, so we use a multiply blend with a
// colored layer to tint light areas while keeping the dark logo intact.
//
// Usage: swift scripts/generate-app-icons.swift
//
// Input:  ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
// Output: ios/App/App/Assets.xcassets/AppIcon-Dev.appiconset/
//         ios/App/App/Assets.xcassets/AppIcon-Staging.appiconset/

import AppKit
import CoreImage
import CoreText
import Foundation
import ImageIO

let assetsDir = "ios/App/App/Assets.xcassets"
let sourceIcon = "\(assetsDir)/AppIcon.appiconset/AppIcon-512@2x.png"

struct IconVariant {
    let name: String
    let tintColor: (r: CGFloat, g: CGFloat, b: CGFloat)
    let label: String
    let bannerColor: (r: CGFloat, g: CGFloat, b: CGFloat)
}

let variants: [IconVariant] = [
    // Blue tint for dev — light blue background, dark blue banner
    IconVariant(
        name: "AppIcon-Dev",
        tintColor: (r: 0.7, g: 0.82, b: 1.0),
        label: "DEV",
        bannerColor: (r: 0.15, g: 0.3, b: 0.6)
    ),
    // Orange tint for staging — light orange background, dark orange banner
    IconVariant(
        name: "AppIcon-Staging",
        tintColor: (r: 1.0, g: 0.82, b: 0.6),
        label: "STG",
        bannerColor: (r: 0.7, g: 0.35, b: 0.05)
    ),
]

func loadCGImage(_ path: String) -> CGImage {
    guard let data = FileManager.default.contents(atPath: path),
          let dataProvider = CGDataProvider(data: data as CFData),
          let image = CGImage(
              pngDataProviderSource: dataProvider,
              decode: nil, shouldInterpolate: true,
              intent: .defaultIntent
          ) else {
        fatalError("Cannot load image at \(path)")
    }
    return image
}

/// Apply a color tint using multiply blend: light pixels take on the tint
/// color, dark pixels stay dark.
func applyTint(_ source: CGImage, color: (r: CGFloat, g: CGFloat, b: CGFloat)) -> CGImage {
    let w = source.width
    let h = source.height
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let ctx = CGContext(
        data: nil, width: w, height: h,
        bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!

    // Draw the original image
    let rect = CGRect(x: 0, y: 0, width: w, height: h)
    ctx.draw(source, in: rect)

    // Multiply blend a solid color on top: white → tint color, black → black
    ctx.setBlendMode(.multiply)
    ctx.setFillColor(CGColor(red: color.r, green: color.g, blue: color.b, alpha: 1.0))
    ctx.fill(rect)

    return ctx.makeImage()!
}

func addTextBanner(
    _ cgImage: CGImage,
    text: String,
    bannerColor: (r: CGFloat, g: CGFloat, b: CGFloat)
) -> CGImage {
    let w = cgImage.width
    let h = cgImage.height
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let ctx = CGContext(
        data: nil, width: w, height: h,
        bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!

    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))

    // Colored banner at bottom
    let bannerH = Int(Double(h) * 0.22)
    ctx.setFillColor(CGColor(
        red: bannerColor.r, green: bannerColor.g, blue: bannerColor.b, alpha: 0.85
    ))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: bannerH))

    // Draw text centered in banner
    let fontSize = CGFloat(bannerH) * 0.65
    let font = CTFontCreateWithName("Helvetica-Bold" as CFString, fontSize, nil)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor.white,
    ]
    let attrStr = NSAttributedString(string: text, attributes: attrs)
    let line = CTLineCreateWithAttributedString(attrStr)
    let bounds = CTLineGetBoundsWithOptions(line, [])

    let textX = (CGFloat(w) - bounds.width) / 2.0
    let textY = (CGFloat(bannerH) - bounds.height) / 2.0 - bounds.origin.y

    ctx.textPosition = CGPoint(x: textX, y: textY)
    CTLineDraw(line, ctx)

    return ctx.makeImage()!
}

func savePNG(_ cgImage: CGImage, to path: String) {
    let url = URL(fileURLWithPath: path)
    let dest = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, cgImage, nil)
    guard CGImageDestinationFinalize(dest) else {
        fatalError("Failed to write PNG to \(path)")
    }
}

func writeContentsJSON(to dir: String, imageName: String) {
    let json = """
    {
      "images" : [
        {
          "filename" : "\(imageName)",
          "idiom" : "universal",
          "platform" : "ios",
          "size" : "1024x1024"
        }
      ],
      "info" : {
        "author" : "xcode",
        "version" : 1
      }
    }

    """
    let path = "\(dir)/Contents.json"
    try! json.write(toFile: path, atomically: true, encoding: .utf8)
}

// Main
let source = loadCGImage(sourceIcon)

for variant in variants {
    let dir = "\(assetsDir)/\(variant.name).appiconset"
    try? FileManager.default.createDirectory(
        atPath: dir, withIntermediateDirectories: true)

    let tinted = applyTint(source, color: variant.tintColor)
    let withBanner = addTextBanner(
        tinted, text: variant.label, bannerColor: variant.bannerColor)

    let filename = "\(variant.name)-512@2x.png"
    savePNG(withBanner, to: "\(dir)/\(filename)")
    writeContentsJSON(to: dir, imageName: filename)

    print("Generated \(variant.name)")
}

print("Done. Icon variants created in \(assetsDir)/")
