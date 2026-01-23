//
//  BrigoWidget.swift
//  BrigoWidget
//
//  Duolingo-inspired Study Companion Widget
//  Intelligent Theme & Auto-Fitter System (Tactile 2026)
//

import WidgetKit
import SwiftUI

// MARK: - Intelligent Theme Modeling (6-Period Day + Danger Override)

enum WidgetVibe: Equatable {
    case earlyMorning  // 5 AM - 8 AM: Soft sunrise
    case midMorning    // 8 AM - 11 AM: Fresh blue
    case midday        // 11 AM - 3 PM: Bright sky
    case afternoon     // 3 PM - 6 PM: Warm golden
    case evening       // 6 PM - 9 PM: Purple dusk
    case lateNight     // 9 PM - 5 AM: Midnight
    case danger        // Override: Streak at risk (any time)
    
    static func current(for entry: SimpleEntry) -> WidgetVibe {
        let hour = Calendar.current.component(.hour, from: entry.date)
        
        // DANGER OVERRIDE: Streak at risk takes priority (urgent red)
        if !entry.data.studyStatus.securedToday && entry.data.streak > 0 {
            return .danger
        }
        
        // TIME-BASED VIBES (6 periods throughout the day)
        switch hour {
        case 5..<8:
            return .earlyMorning
        case 8..<11:
            return .midMorning
        case 11..<15:
            return .midday
        case 15..<18:
            return .afternoon
        case 18..<21:
            return .evening
        default: // 21-24, 0-5
            return .lateNight
        }
    }
    
    var backgroundImageName: String {
        switch self {
        case .earlyMorning: return "widget_bg_morning_stage"
        case .midMorning: return "widget_bg_secured_stage"
        case .midday: return "widget_bg_secured_stage"
        case .afternoon: return "widget_bg_danger_stage"  // Repurposed as warm sunset
        case .evening: return "widget_bg_night_stage"
        case .lateNight: return "widget_bg_night_stage"
        case .danger: return "widget_bg_danger_stage"
        }
    }
    
    var backgroundColors: [Color] {
        switch self {
        case .earlyMorning: return [Color(hex: "#FFD0AD"), Color(hex: "#7A96FF")]  // Peach → Lilac
        case .midMorning: return [Color(hex: "#43CBFF"), Color(hex: "#9708CC")]    // Fresh Blue → Purple
        case .midday: return [Color(hex: "#667eea"), Color(hex: "#764ba2")]        // Bright Indigo
        case .afternoon: return [Color(hex: "#f093fb"), Color(hex: "#f5576c")]     // Pink → Coral
        case .evening: return [Color(hex: "#5f2c82"), Color(hex: "#49a09d")]       // Purple → Teal
        case .lateNight: return [Color(hex: "#0F2027"), Color(hex: "#203A43")]     // Deep Midnight
        case .danger: return [Color(hex: "#FF4B11"), Color(hex: "#FF9800")]        // Urgent Red-Orange
        }
    }
    
    /// Whether to show the background image (illustrations) or pure gradient
    var showsBackgroundImage: Bool {
        switch self {
        case .earlyMorning, .lateNight:
            return true  // Calm vibes get scenic illustrations
        case .midMorning, .midday, .afternoon, .evening, .danger:
            return false // Active vibes get pure vibrant gradients
        }
    }
}

// MARK: - Mascot Auto-Fitter (Per-Asset Tuning)

struct MascotConfig {
    let scale: CGFloat
    let offsetY: CGFloat  // Positive = down, Negative = up
    
    /// Individual configs for each Brigo asset
    static func resolve(for imageName: String) -> MascotConfig {
        switch imageName {
        // STANDARD POSES (vertical/square) - Bigger, bottom-anchored
        case "brigo-proud":
            return MascotConfig(scale: 1.55, offsetY: 10)
        case "brigo-happy":
            return MascotConfig(scale: 1.55, offsetY: 10)
        case "brigo-smug":
            return MascotConfig(scale: 1.55, offsetY: 10)
        case "brigo-just-5-minutes":
            return MascotConfig(scale: 1.50, offsetY: 12)
        case "brigo-studying-without-you":
            return MascotConfig(scale: 1.50, offsetY: 10)
        case "brigo-dying-to-study":
            return MascotConfig(scale: 1.45, offsetY: 12)
        case "brigo-save-the-streak":
            return MascotConfig(scale: 1.45, offsetY: 12)
            
        // HORIZONTAL/WIDE POSES - Anchored at bottom with reduced scale to prevent text overlap
        case "brigo-please-study":
            return MascotConfig(scale: 1.25, offsetY: 8)  // Reduced scale, anchored at bottom
        case "brigo-is-waiting":
            return MascotConfig(scale: 1.25, offsetY: 8)  // Reduced scale, anchored at bottom
        case "brigo-still-scrolling":
            return MascotConfig(scale: 1.25, offsetY: 8)  // Reduced scale, anchored at bottom
        case "brigo-miss-me-yet":
            return MascotConfig(scale: 1.35, offsetY: 8)  // Adjusted to bring up slightly
            
        // PET STAGES (legacy)
        case let name where name.contains("stage1"):
            return MascotConfig(scale: 1.35, offsetY: 5)
        case let name where name.contains("stage3"):
            return MascotConfig(scale: 1.05, offsetY: -5)
            
        // Default fallback
        default:
            return MascotConfig(scale: 1.45, offsetY: 8)
        }
    }
}

// MARK: - Timeline Provider

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), data: WidgetData.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), data: WidgetData.placeholder)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let widgetData = WidgetDataManager.shared.loadWidgetData() ?? WidgetData.placeholder
        let now = Date()
        var entries: [SimpleEntry] = []
        
        // Generate 6 entries for the next hour (every 10 minutes)
        // This makes the widget feel "alive" by rotating mascots/messages even when offline
        for i in 0..<6 {
            let entryDate = Calendar.current.date(byAdding: .minute, value: i * 10, to: now)!
            entries.append(SimpleEntry(date: entryDate, data: widgetData))
        }
        
        let nextRefresh = Calendar.current.date(byAdding: .hour, value: 1, to: now) ?? now
        let timeline = Timeline(entries: entries, policy: .after(nextRefresh))
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
    
    // Computed deep link based on suggested activity
    var deepLinkURL: URL? {
        return URL(string: "brigo://")
    }
}

// MARK: - Premium Flame Shape

struct FlameShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        
        // Custom "S-Curve" Flame Path inspired by Duolingo
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.05))
        
        // Right side curve
        path.addCurve(to: CGPoint(x: w * 0.92, y: h * 0.72),
                     control1: CGPoint(x: w * 0.85, y: h * 0.1),
                     control2: CGPoint(x: w * 1.05, y: h * 0.45))
        
        // Bottom curve
        path.addCurve(to: CGPoint(x: w * 0.08, y: h * 0.72),
                     control1: CGPoint(x: w * 0.8, y: h * 1.05),
                     control2: CGPoint(x: w * 0.2, y: h * 1.05))
        
        // Left side "notch" curve
        path.addCurve(to: CGPoint(x: w * 0.32, y: h * 0.38),
                     control1: CGPoint(x: w * -0.05, y: h * 0.4),
                     control2: CGPoint(x: w * 0.2, y: h * 0.4))
        
        path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.05),
                     control1: CGPoint(x: w * 0.45, y: h * 0.25),
                     control2: CGPoint(x: w * 0.4, y: h * 0.05))
        
        return path
    }
}

// MARK: - Core Teardrop Shape

struct TeardropShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.2))
        
        path.addCurve(to: CGPoint(x: w * 0.85, y: h * 0.7),
                     control1: CGPoint(x: w * 0.8, y: h * 0.3),
                     control2: CGPoint(x: w * 0.95, y: h * 0.5))
        
        path.addCurve(to: CGPoint(x: w * 0.15, y: h * 0.7),
                     control1: CGPoint(x: w * 0.7, y: h * 1.0),
                     control2: CGPoint(x: w * 0.3, y: h * 1.0))
        
        path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.2),
                     control1: CGPoint(x: w * 0.05, y: h * 0.5),
                     control2: CGPoint(x: w * 0.2, y: h * 0.3))
        
        return path
    }
}

// MARK: - Dynamic Streak Fire View

struct StreakFireView: View {
    let vibe: WidgetVibe
    let isSecured: Bool
    let streak: Int
    let size: CGFloat
    
    var body: some View {
        ZStack {
            if streak == 0 {
                // Glass / Empty State
                FlameShape()
                    .stroke(lineWidth: 2.5)
                    .foregroundColor(.white.opacity(0.4))
                    .frame(width: size, height: size * 1.25)
            } else {
                // White Flame with Transparent Teardrop Cutout
                ZStack {
                    // Outer Shell: Premium White Porcelain Look
                    FlameShape()
                        .fill(Color(hex: "#F5F7FA")) // Soft off-white
                    
                    // Inner Teardrop: Cutout to show background
                    TeardropShape()
                        .fill(Color.black) // This color doesn't matter, it becomes transparent
                        .scaleEffect(0.48)
                        .offset(y: size * 0.14)
                        .blendMode(.destinationOut) // Creates the "hole"
                }
                .frame(width: size, height: size * 1.31)
                .compositingGroup() // Required for blendMode to work
                .shadow(color: .black.opacity(0.1), radius: 2, y: 1)
                
                // ⚠️ Danger Badge (Duolingo-style) - Shows when streak is at risk
                if !isSecured && streak > 0 {
                    ZStack {
                        Circle()
                            .fill(Color(hex: "#FF3B30")) // Apple Red
                            .frame(width: size * 0.45, height: size * 0.45)
                        
                        Text("!")
                            .font(.system(size: size * 0.28, weight: .heavy, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .offset(x: size * 0.32, y: size * 0.35) // Bottom-right position
                    .shadow(color: .black.opacity(0.2), radius: 1, y: 1)
                    .accessibilityLabel("Streak at risk! Study now to save it.")
                }
            }
        }
    }
}

// MARK: - Widget Entry View

struct BrigoWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family


    var vibe: WidgetVibe {
        WidgetVibe.current(for: entry)
    }

    // MARK: - Paired Scene System (Message + Mascot coherence)
    
    /// A single "scene" pairs a message with its appropriate mascot
    struct WidgetScene {
        let messageTemplate: String // Use %@ for pet name placeholder
        let mascot: String
    }
    
    /// Get the current scene based on time and streak status
    var currentScene: WidgetScene {
        let petName = entry.data.pet.name
        let hour = Calendar.current.component(.hour, from: entry.date)
        let rotationIndex = Int(entry.date.timeIntervalSinceReferenceDate / 300) // 5-minute rotation
        
        let scenes: [WidgetScene]
        
        if entry.data.studyStatus.securedToday {
            // Secured: Celebratory and encouraging scenes
            scenes = [
                WidgetScene(messageTemplate: "Brigo is proud!", mascot: "brigo-proud"),
                WidgetScene(messageTemplate: "\(petName) is safe!", mascot: "brigo-happy"),
                WidgetScene(messageTemplate: "Nice work! Study more?", mascot: "brigo-smug"),
                WidgetScene(messageTemplate: "Miss me yet?", mascot: "brigo-miss-me-yet"),
                WidgetScene(messageTemplate: "Just 5 minutes?", mascot: "brigo-just-5-minutes"),
                WidgetScene(messageTemplate: "Studying without you?", mascot: "brigo-studying-without-you"),
                WidgetScene(messageTemplate: "Quick quiz?", mascot: "brigo-smug"),
                WidgetScene(messageTemplate: "Golden streak! Review?", mascot: "brigo-proud"),
                WidgetScene(messageTemplate: "You're ahead! One more?", mascot: "brigo-happy"),
            ]
        } else if entry.data.streak > 0 {
            // Danger Zone: Streak at risk
            switch hour {
            case 21...23, 0..<6: // Late Night - Maximum urgency
                scenes = [
                    WidgetScene(messageTemplate: "Please study!", mascot: "brigo-please-study"),
                    WidgetScene(messageTemplate: "Save \(petName)!", mascot: "brigo-save-the-streak"),
                    WidgetScene(messageTemplate: "Last chance!", mascot: "brigo-dying-to-study"),
                    WidgetScene(messageTemplate: "Still scrolling?", mascot: "brigo-still-scrolling"),
                    WidgetScene(messageTemplate: "Don't let \(petName) die!", mascot: "brigo-please-study"),
                    WidgetScene(messageTemplate: "Brigo is worried!", mascot: "brigo-save-the-streak"),
                ]
            case 17..<21: // Evening - High urgency
                scenes = [
                    WidgetScene(messageTemplate: "Save your streak!", mascot: "brigo-save-the-streak"),
                    WidgetScene(messageTemplate: "\(petName) is waiting...", mascot: "brigo-is-waiting"),
                    WidgetScene(messageTemplate: "Still scrolling?", mascot: "brigo-still-scrolling"),
                    WidgetScene(messageTemplate: "Time to lock in.", mascot: "brigo-smug"),
                    WidgetScene(messageTemplate: "Please study!", mascot: "brigo-please-study"),
                    WidgetScene(messageTemplate: "Brigo is waiting!", mascot: "brigo-is-waiting"),
                    WidgetScene(messageTemplate: "Evening grind?", mascot: "brigo-just-5-minutes"),
                ]
            case 10..<17: // Mid-day - Gentle nudge
                scenes = [
                    WidgetScene(messageTemplate: "Just 5 minutes?", mascot: "brigo-just-5-minutes"),
                    WidgetScene(messageTemplate: "Quick session?", mascot: "brigo-smug"),
                    WidgetScene(messageTemplate: "Still scrolling?", mascot: "brigo-still-scrolling"),
                    WidgetScene(messageTemplate: "Studying without you?", mascot: "brigo-studying-without-you"),
                    WidgetScene(messageTemplate: "Don't break the chain!", mascot: "brigo-save-the-streak"),
                    WidgetScene(messageTemplate: "Brigo is waiting!", mascot: "brigo-is-waiting"),
                    WidgetScene(messageTemplate: "Don't ignore \(petName)!", mascot: "brigo-dying-to-study"),
                ]
            default: // Morning
                scenes = [
                    WidgetScene(messageTemplate: "Get started early!", mascot: "brigo-happy"),
                    WidgetScene(messageTemplate: "\(petName) is ready!", mascot: "brigo-proud"),
                    WidgetScene(messageTemplate: "Morning session!", mascot: "brigo-just-5-minutes"),
                    WidgetScene(messageTemplate: "Brigo is waiting!", mascot: "brigo-is-waiting"),
                    WidgetScene(messageTemplate: "Ready for round 1?", mascot: "brigo-smug"),
                ]
            }
        } else {
            // No streak yet - Welcoming scenes
            scenes = [
                WidgetScene(messageTemplate: "Start your streak!", mascot: "brigo-happy"),
                WidgetScene(messageTemplate: "Let's begin!", mascot: "brigo-proud"),
                WidgetScene(messageTemplate: "Just 5 minutes?", mascot: "brigo-just-5-minutes"),
                WidgetScene(messageTemplate: "Brigo is waiting!", mascot: "brigo-is-waiting"),
            ]
        }
        
        return scenes[rotationIndex % scenes.count]
    }
    
    
    var message: String {
        return currentScene.messageTemplate
    }
    
    var mascotImageName: String {
        return currentScene.mascot
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .center) {
                VStack(spacing: 0) {
                    // Top Section: Compact header like Duolingo
                    VStack(spacing: 2) {
                        HStack(alignment: .center, spacing: 6) {
                            // Custom SwiftUI Flame
                            StreakFireView(
                                vibe: vibe,
                                isSecured: entry.data.studyStatus.securedToday,
                                streak: entry.data.streak,
                                size: 28
                            )
                            .offset(y: -4)
                            
                            // Streak Count
                            Text("\(entry.data.streak)")
                                .font(.system(size: 34, weight: .bold, design: .rounded))
                                .foregroundStyle(
                                    .linearGradient(
                                        colors: [.white, Color(hex: "#FFF9D4")],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                                .tracking(-0.5)
                                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
                                .accessibilityLabel("\(entry.data.streak) day streak")
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                        .accessibilityElement(children: .combine)
                        
                        // Message text
                        Text(message)
                            .font(.system(size: 20, weight: .semibold, design: .rounded))
                            .foregroundColor(.white.opacity(0.96))
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.horizontal, 12)
                    }
                    .padding(.top, 14)
                    
                    Spacer()
                    
                    // Mascot: Gets bottom ~50% of widget
                    let config = MascotConfig.resolve(for: mascotImageName)
                    ZStack(alignment: .bottom) {
                        Image(mascotImageName)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .scaleEffect(config.scale)
                            .frame(width: geometry.size.width, height: geometry.size.height * 0.55)
                            .offset(y: config.offsetY)
                    }
                    .frame(maxWidth: .infinity)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .widgetURL(entry.deepLinkURL) // <--- Smart Deep Link enabled here
    }
}

// MARK: - Background Component (Intelligent Rendering)

struct WidgetBackground: View {
    let vibe: WidgetVibe
    
    var body: some View {
        ZStack {
            // Foundation: Vibrant Dynamic Gradient (Always present)
            LinearGradient(
                colors: vibe.backgroundColors,
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            // Scenic Layer: Illustration only for calm vibes (Early Morning/Late Night)
            if vibe.showsBackgroundImage {
                Image(vibe.backgroundImageName)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            }
            
            // Depth Layer: Subtle overlay to ensure text contrast
            LinearGradient(
                colors: [.black.opacity(0.1), .clear, .black.opacity(0.1)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}

// MARK: - Widget Configuration

struct BrigoWidget: Widget {
    let kind: String = "BrigoWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            BrigoWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetBackground(vibe: WidgetVibe.current(for: entry))
                }
        }
        .configurationDisplayName("Brigo")
        .description("Keep your streak alive!")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// MARK: - Extensions

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 255, 255, 255)
        }
        self.init(.sRGB, red: Double(r)/255, green: Double(g)/255, blue: Double(b)/255, opacity: Double(a)/255)
    }
}
