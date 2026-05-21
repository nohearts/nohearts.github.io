import { mkdir, writeFile } from "node:fs/promises";

const BASE_URL = "https://wahapedia.ru/wh40k10ed";
const OUT_FILE = new URL("../data/stratagems.json", import.meta.url);

const SOURCES = {
    factions: `${BASE_URL}/Factions.csv`,
    stratagems: `${BASE_URL}/Stratagems.csv`,
    lastUpdate: `${BASE_URL}/Last_update.csv`
};

function parseDelimited(text) {
    const records = [];
    let record = [];
    let field = "";
    let quoted = false;
    const input = text.replace(/^\uFEFF/, "");

    for (let index = 0; index < input.length; index += 1) {
        const char = input[index];
        const next = input[index + 1];

        if (char === "\"") {
            if (quoted && next === "\"") {
                field += "\"";
                index += 1;
            } else {
                quoted = !quoted;
            }
            continue;
        }

        if (char === "|" && !quoted) {
            record.push(field);
            field = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && next === "\n") index += 1;
            record.push(field);
            field = "";
            if (record.some((value) => value !== "")) records.push(record);
            record = [];
            continue;
        }

        field += char;
    }

    if (field || record.length) {
        record.push(field);
        records.push(record);
    }

    const headers = records.shift().map((header) => header.trim());

    return records.map((values) => {
        return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
}

function stripHtml(html) {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#039;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&ldquo;/g, "\"")
        .replace(/&rdquo;/g, "\"")
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}

function normalizeCost(value) {
    const match = String(value || "").match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : 0;
}

function normalizePhase(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("command")) return "Command";
    if (text.includes("movement")) return "Movement";
    if (text.includes("shooting")) return "Shooting";
    if (text.includes("charge")) return "Charge";
    if (text.includes("fight")) return "Fight";
    if (text.includes("any")) return "Any";
    return "Other";
}

function typeParts(value) {
    const text = String(value || "").trim();
    const [prefix, suffix] = text.split(/\s+[–-]\s+/);
    const typeText = suffix || text || "Unknown";
    return {
        scope: suffix ? prefix : "",
        category: typeText.replace(/\s*Stratagem\s*$/i, "").trim() || "Unknown",
        raw: text
    };
}

function sectionValue(text, label) {
    const labels = ["WHEN", "TARGET", "RESTRICTION", "EFFECT"];
    const alternatives = labels.filter((item) => item !== label).join("|");
    const pattern = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n(?:${alternatives}):|$)`, "i");
    return text.match(pattern)?.[1]?.trim() || "";
}

async function fetchCsv(name, url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Unable to download ${name}: ${response.status} ${response.statusText}`);
    }
    const decoder = new TextDecoder("utf-8");
    return parseDelimited(decoder.decode(await response.arrayBuffer()));
}

const [factions, stratagemRows, lastUpdateRows] = await Promise.all([
    fetchCsv("Factions.csv", SOURCES.factions),
    fetchCsv("Stratagems.csv", SOURCES.stratagems),
    fetchCsv("Last_update.csv", SOURCES.lastUpdate).catch(() => [])
]);

const factionsById = new Map(factions.map((faction) => [faction.id, faction]));

const stratagems = stratagemRows.filter((row) => {
    if (!row.name || (!row.cp_cost && !row.type)) return false;
    const type = typeParts(row.type);
    return type.scope !== "Boarding Actions";
}).map((row) => {
    const faction = factionsById.get(row.faction_id);
    const description = stripHtml(row.description || "");
    const legend = stripHtml(row.legend || "");
    const type = typeParts(row.type);
    const fallbackScope = type.scope && type.scope !== type.category ? type.scope : "";

    return {
        id: row.id,
        name: row.name,
        cost: normalizeCost(row.cp_cost),
        costText: row.cp_cost,
        faction: faction?.name || fallbackScope || "Core",
        factionId: row.faction_id,
        detachment: row.detachment || (!faction?.name ? fallbackScope : ""),
        type: type.category === "Unknown" && row.cp_cost ? "Stratagem" : type.category,
        rawType: type.raw,
        turn: row.turn || "",
        phase: normalizePhase(row.phase),
        phaseText: row.phase || "",
        when: sectionValue(description, "WHEN") || [row.turn, row.phase].filter(Boolean).join(", "),
        target: sectionValue(description, "TARGET"),
        restriction: sectionValue(description, "RESTRICTION"),
        effect: sectionValue(description, "EFFECT") || description,
        legend,
        sourceUrl: faction?.link || ""
    };
});

const lastUpdate = Object.fromEntries(
    lastUpdateRows
        .filter((row) => row.id || row.key || row.name)
        .map((row) => [row.id || row.key || row.name, row.value || row.date || row.last_update || ""])
);

const payload = {
    generatedAt: new Date().toISOString(),
    attribution: "Powered by Wahapedia data export",
    sources: SOURCES,
    lastUpdate,
    stratagems
};

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Wrote ${stratagems.length} stratagems to ${OUT_FILE.pathname}`);
