// Renders the photocar.ai icon, Android adaptive icon layers and splash wordmark from the brand faces,
// as SVG sources (text as paths, no font dependency) and PNGs. macOS only: CoreText + CoreGraphics.
//
//   cd apps/mobile && DEVELOPER_DIR=<Xcode>/Contents/Developer xcrun swift assets/brand/render.swift
//
// Design: docs/superpowers/specs/2026-11-23-photocar-ui-design.md §9 — a field-code box (like the
// app's CodeChip) holding "pc" in Overpass Mono 600, ink on the sage paper.
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct RGB { let r, g, b: CGFloat }
let paper = RGB(r: 0xE8 / 255, g: 0xED / 255, b: 0xE9 / 255)
let ink = RGB(r: 0x12 / 255, g: 0x29 / 255, b: 0x1F / 255)
let ink2 = RGB(r: 0x4A / 255, g: 0x5D / 255, b: 0x55 / 255)
let black = RGB(r: 0, g: 0, b: 0)
func hex(_ c: RGB) -> String { String(format: "#%02X%02X%02X", Int(round(c.r * 255)), Int(round(c.g * 255)), Int(round(c.b * 255))) }

let fontsDir = "node_modules/@expo-google-fonts"
func font(_ file: String, _ size: CGFloat) -> CTFont {
  let url = URL(fileURLWithPath: "\(fontsDir)/\(file)") as CFURL
  guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url) as? [CTFontDescriptor], let d = descriptors.first else {
    fatalError("font not found: \(file) (run from apps/mobile after npm install)")
  }
  return CTFontCreateWithFontDescriptor(d, size, nil)
}

// Glyph outlines of a string, baseline at y = 0, y up.
func textPath(_ s: String, _ f: CTFont) -> CGPath {
  let attributed = NSAttributedString(string: s, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): f])
  let line = CTLineCreateWithAttributedString(attributed)
  let path = CGMutablePath()
  for run in CTLineGetGlyphRuns(line) as! [CTRun] {
    let n = CTRunGetGlyphCount(run)
    var glyphs = [CGGlyph](repeating: 0, count: n)
    var positions = [CGPoint](repeating: .zero, count: n)
    CTRunGetGlyphs(run, CFRange(location: 0, length: n), &glyphs)
    CTRunGetPositions(run, CFRange(location: 0, length: n), &positions)
    for i in 0..<n {
      if let g = CTFontCreatePathForGlyph(f, glyphs[i], nil) {
        path.addPath(g, transform: CGAffineTransform(translationX: positions[i].x, y: positions[i].y))
      }
    }
  }
  return path
}

func moved(_ p: CGPath, _ t: CGAffineTransform) -> CGPath {
  let m = CGMutablePath()
  m.addPath(p, transform: t)
  return m
}

// SVG path data in a canvas of the given height (SVG y runs down).
func svgPath(_ p: CGPath, height h: CGFloat) -> String {
  var d = ""
  func pt(_ q: CGPoint) -> String { String(format: "%.2f %.2f", q.x, h - q.y) }
  p.applyWithBlock { e in
    let el = e.pointee
    switch el.type {
    case .moveToPoint: d += "M\(pt(el.points[0]))"
    case .addLineToPoint: d += "L\(pt(el.points[0]))"
    case .addQuadCurveToPoint: d += "Q\(pt(el.points[0])) \(pt(el.points[1]))"
    case .addCurveToPoint: d += "C\(pt(el.points[0])) \(pt(el.points[1])) \(pt(el.points[2]))"
    case .closeSubpath: d += "Z"
    @unknown default: break
    }
  }
  return d
}

struct Layer { let path: CGPath; let color: RGB; let stroke: CGFloat? }

func write(_ name: String, width w: Int, height h: Int, background: RGB?, layers: [Layer]) {
  // PNG
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpace(name: CGColorSpace.sRGB)!,
                      // Opaque art has no alpha channel (the App Store rejects an icon that carries one).
                      bitmapInfo: (background == nil ? CGImageAlphaInfo.premultipliedLast : CGImageAlphaInfo.noneSkipLast).rawValue)!
  if let bg = background {
    ctx.setFillColor(red: bg.r, green: bg.g, blue: bg.b, alpha: 1)
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  }
  for l in layers {
    ctx.addPath(l.path)
    if let s = l.stroke {
      ctx.setStrokeColor(red: l.color.r, green: l.color.g, blue: l.color.b, alpha: 1)
      ctx.setLineWidth(s)
      ctx.strokePath()
    } else {
      ctx.setFillColor(red: l.color.r, green: l.color.g, blue: l.color.b, alpha: 1)
      ctx.fillPath()
    }
  }
  let url = URL(fileURLWithPath: "assets/images/\(name).png") as CFURL
  let dest = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
  CGImageDestinationFinalize(dest)
  // SVG source
  var svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(w)\" height=\"\(h)\" viewBox=\"0 0 \(w) \(h)\">\n"
  if let bg = background { svg += "  <rect width=\"\(w)\" height=\"\(h)\" fill=\"\(hex(bg))\"/>\n" }
  for l in layers {
    let d = svgPath(l.path, height: CGFloat(h))
    if let s = l.stroke {
      svg += "  <path d=\"\(d)\" fill=\"none\" stroke=\"\(hex(l.color))\" stroke-width=\"\(s)\"/>\n"
    } else {
      svg += "  <path d=\"\(d)\" fill=\"\(hex(l.color))\"/>\n"
    }
  }
  svg += "</svg>\n"
  try! svg.write(toFile: "assets/brand/\(name).svg", atomically: true, encoding: .utf8)
  print("wrote assets/images/\(name).png and assets/brand/\(name).svg")
}

// The mark: a code box with "pc", centred in a square of side `side`, scaled by `scale`.
func mark(side: CGFloat, scale: CGFloat, color: RGB) -> [Layer] {
  let c = CGPoint(x: side / 2, y: side / 2)
  let bw = 600 * scale, bh = 420 * scale, stroke = 34 * scale, corner = 64 * scale
  let box = CGPath(roundedRect: CGRect(x: c.x - bw / 2, y: c.y - bh / 2, width: bw, height: bh),
                   cornerWidth: corner, cornerHeight: corner, transform: nil)
  let raw = textPath("pc", font("overpass-mono/600SemiBold/OverpassMono_600SemiBold.ttf", 300 * scale))
  let b = raw.boundingBoxOfPath
  let text = moved(raw, CGAffineTransform(translationX: c.x - b.midX, y: c.y - b.midY))
  return [Layer(path: box, color: color, stroke: stroke), Layer(path: text, color: color, stroke: nil)]
}

// iOS / store icon: opaque, the mark on paper.
write("icon", width: 1024, height: 1024, background: paper, layers: mark(side: 1024, scale: 1, color: ink))
// Android adaptive icon: the mark inside the 66 % safe zone, plain paper behind, a one-colour layer for themed icons.
write("android-icon-foreground", width: 1024, height: 1024, background: nil, layers: mark(side: 1024, scale: 0.72, color: ink))
write("android-icon-background", width: 1024, height: 1024, background: paper, layers: [])
write("android-icon-monochrome", width: 1024, height: 1024, background: nil, layers: mark(side: 1024, scale: 0.72, color: black))

// Splash: the wordmark, "photocar" in ink and ".ai" in ink2, on transparent (the splash colour is paper).
do {
  let f = font("barlow-semi-condensed/600SemiBold/BarlowSemiCondensed_600SemiBold.ttf", 200)
  let word = textPath("photocar", f)
  let ai = textPath(".ai", f)
  let advance = CTLineGetTypographicBounds(CTLineCreateWithAttributedString(NSAttributedString(
    string: "photocar", attributes: [NSAttributedString.Key(kCTFontAttributeName as String): f])), nil, nil, nil)
  let aiMoved = moved(ai, CGAffineTransform(translationX: CGFloat(advance), y: 0))
  let all = CGMutablePath()
  all.addPath(word)
  all.addPath(aiMoved)
  let b = all.boundingBoxOfPath
  let pad: CGFloat = 24
  let w = Int(ceil(b.width + 2 * pad)), h = Int(ceil(b.height + 2 * pad))
  let t = CGAffineTransform(translationX: pad - b.minX, y: pad - b.minY)
  write("splash-icon", width: w, height: h, background: nil,
        layers: [Layer(path: moved(word, t), color: ink, stroke: nil), Layer(path: moved(aiMoved, t), color: ink2, stroke: nil)])
}
