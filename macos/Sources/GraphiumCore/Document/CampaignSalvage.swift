import Foundation

/// Opening a campaign whose `campaign.json` is partly unreadable (a hand edit, another
/// tool, a bug in an older build). Rather than refuse the whole file, the smallest part
/// that doesn't decode is moved out: the bad field when the campaign reads without it,
/// otherwise the object holding it (a token, a door, a map). Each piece goes to
/// `Preserved.setAside` with where it came from and why, and is written back under
/// `setAside` on save, so nothing is lost and the DM (or a fixed build) can put it back.
///
/// What can't be salvaged still fails with `.damaged`: JSON that doesn't parse, a bad
/// `formatVersion`, or a campaign-level field such as its name.
extension CampaignPackage {
    /// More than this many bad pieces and the file is treated as not a campaign at all.
    static let maxSetAside = 200

    /// One step of a decoding path: an object key or an array index.
    enum PathStep: Equatable {
        case key(String)
        case index(Int)
    }

    /// The decoded manifest, the tree it was decoded from (with set-aside pieces removed),
    /// and the entries set aside by this read.
    static func decodeSalvaging(_ data: Data) throws -> (Manifest, RawJSON, [RawJSON]) {
        let first: DecodingError
        do {
            let decoded = try JSONDecoder().decode(Manifest.self, from: data)
            return (decoded, try JSONDecoder().decode(RawJSON.self, from: data), [])
        } catch let error as DecodingError {
            first = error
        }
        var tree = try decodingManifest { try JSONDecoder().decode(RawJSON.self, from: data) }
        var setAside: [RawJSON] = []
        var error = first
        while setAside.count < maxSetAside, let entry = salvage(&tree, after: error) {
            setAside.append(entry)
            switch decode(tree) {
            case .success(let decoded):
                let places = setAside.compactMap { $0.field("from") }.joined(separator: "; ")
                Diagnostics.log(.error, "Opened a campaign with \(setAside.count) set aside: \(places)", category: "document")
                return (decoded, tree, setAside)
            case .failure(let next):
                error = next
            }
        }
        // Nothing smaller than the campaign itself could be set aside: report that problem.
        let detail = describe(error)
        Diagnostics.log(.error, "campaign.json didn't decode: \(detail)", category: "document")
        throw FormatError.damaged(detail)
    }

    static func decode(_ tree: RawJSON) -> Result<Manifest, DecodingError> {
        do {
            return .success(try JSONDecoder().decode(Manifest.self, from: JSONEncoder().encode(tree)))
        } catch let error as DecodingError {
            return .failure(error)
        } catch {
            return .failure(.dataCorrupted(.init(codingPath: [], debugDescription: "\(error)")))
        }
    }

    /// Removes the smallest piece of `tree` that makes `error` go away and returns its
    /// set-aside entry, or nil when only the campaign itself would do.
    static func salvage(_ tree: inout RawJSON, after error: DecodingError) -> RawJSON? {
        let path = steps(of: error, in: tree)
        let reason = describe(error)
        // The active map didn't read (or never existed): open the first map that did.
        if path == [.key("campaign"), .key("activeMapId")],
            let firstID = tree.value(at: [.key("campaign"), .key("maps")])?.arrayValue?.first?.id,
            tree.value(at: path) != .string(firstID)
        {
            let old = tree.value(at: path) ?? .null
            tree.set(.string(firstID), at: path)
            return entry(from: path, reason: reason, value: old)
        }
        // Try the bad field first, then each container out to (not including) the campaign.
        for end in stride(from: path.count, through: 2, by: -1) {
            let target = Array(path[0..<end])
            // Array elements go only from lists of objects: dropping one number from a list of
            // points would shift every point after it.
            if case .index = target.last {
                let siblings = tree.value(at: Array(target.dropLast()))?.arrayValue ?? []
                guard siblings.contains(where: \.isObject) else { continue }
            }
            var candidate = tree
            guard let removed = candidate.remove(at: target) else { continue }
            if case .failure(let next) = decode(candidate), madeWorse(next, in: candidate, removing: target) { continue }
            tree = candidate
            return entry(from: target, reason: reason, value: removed)
        }
        return nil
    }

    /// Removing `target` didn't help when the next failure is that very key going missing
    /// (a required field) or a rule in an object around it (a check in its decoder).
    static func madeWorse(_ next: DecodingError, in tree: RawJSON, removing target: [PathStep]) -> Bool {
        let nextPath = steps(of: next, in: tree)
        switch next {
        case .keyNotFound: return nextPath == target
        case .dataCorrupted: return nextPath.count < target.count && target.starts(with: nextPath)
        default: return false
        }
    }

    static func entry(from path: [PathStep], reason: String, value: RawJSON) -> RawJSON {
        .object(["from": .string(placeName(path)), "reason": .string(reason), "value": value])
    }

    /// "campaign › maps[0] › tokens[3]", as `describe` writes places.
    static func placeName(_ path: [PathStep]) -> String {
        var parts: [String] = []
        for step in path {
            switch step {
            case .key(let key): parts.append(key)
            case .index(let index):
                if parts.isEmpty { parts.append("[\(index)]") } else { parts[parts.count - 1] += "[\(index)]" }
            }
        }
        return parts.joined(separator: " › ")
    }

    /// The error's path (with the missing key for `keyNotFound`), read against `tree` so an
    /// integer key counts as an index only where the tree holds an array.
    static func steps(of error: DecodingError, in tree: RawJSON) -> [PathStep] {
        let keys: [CodingKey]
        switch error {
        case .keyNotFound(let key, let context): keys = context.codingPath + [key]
        case .typeMismatch(_, let context), .valueNotFound(_, let context), .dataCorrupted(let context):
            keys = context.codingPath
        @unknown default: keys = []
        }
        var steps: [PathStep] = []
        var node: RawJSON? = tree
        for key in keys {
            if case .array(let items)? = node, let index = key.intValue {
                steps.append(.index(index))
                node = items.indices.contains(index) ? items[index] : nil
            } else {
                steps.append(.key(key.stringValue))
                if case .object(let fields)? = node { node = fields[key.stringValue] } else { node = nil }
            }
        }
        return steps
    }
}

extension RawJSON {
    var isObject: Bool {
        if case .object = self { return true }
        return false
    }

    var arrayValue: [RawJSON]? {
        if case .array(let items) = self { return items }
        return nil
    }

    public func field(_ key: String) -> String? {
        if case .object(let fields) = self, case .string(let value)? = fields[key] { return value }
        return nil
    }

    func value(at path: [CampaignPackage.PathStep]) -> RawJSON? {
        var node = self
        for step in path {
            switch (step, node) {
            case (.key(let key), .object(let fields)):
                guard let next = fields[key] else { return nil }
                node = next
            case (.index(let index), .array(let items)):
                guard items.indices.contains(index) else { return nil }
                node = items[index]
            default:
                return nil
            }
        }
        return node
    }

    mutating func set(_ value: RawJSON, at path: [CampaignPackage.PathStep]) {
        guard let step = path.first else {
            self = value
            return
        }
        let rest = Array(path.dropFirst())
        switch (step, self) {
        case (.key(let key), .object(var fields)):
            var child = fields[key] ?? .null
            child.set(value, at: rest)
            fields[key] = child
            self = .object(fields)
        case (.index(let index), .array(var items)) where items.indices.contains(index):
            items[index].set(value, at: rest)
            self = .array(items)
        default:
            break
        }
    }

    /// Removes the key or array element at `path` and returns it, or nil if there's nothing there.
    mutating func remove(at path: [CampaignPackage.PathStep]) -> RawJSON? {
        guard let step = path.first else { return nil }
        let rest = Array(path.dropFirst())
        switch (step, self) {
        case (.key(let key), .object(var fields)):
            guard var child = fields[key] else { return nil }
            if rest.isEmpty {
                fields[key] = nil
                self = .object(fields)
                return child
            }
            let removed = child.remove(at: rest)
            fields[key] = child
            self = .object(fields)
            return removed
        case (.index(let index), .array(var items)):
            guard items.indices.contains(index) else { return nil }
            if rest.isEmpty {
                let removed = items.remove(at: index)
                self = .array(items)
                return removed
            }
            let removed = items[index].remove(at: rest)
            self = .array(items)
            return removed
        default:
            return nil
        }
    }
}
