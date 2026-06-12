// Scenario V5 dataset builder.
//
// Expands the 300 authored briefs in training/scenario_v5_library.mjs
// into exactly 3,000 chat examples (2,500 train / 250 validation / 250 test)
// using fictional brands only. Everything is deterministic: brand pools are
// authored below, ordering uses stable sha256 hashes, and the script refuses
// to write anything when any validation step fails (including the SmolLM2
// chat-template token-length budget).
//
// This builder is independent from V2/V3/V4 and never touches their files.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { scenarioV5Scenarios } from "./scenario_v5_library.mjs";

const system =
  "Return one compact membership-card JSON object. Preserve primaryColor. Include name, memberId, qrCode. usesQr=true.";
const lockedFields = ["name", "memberId", "qrCode"];
const tokenBudget = 640;
const tokenizerModel = "HuggingFaceTB/SmolLM2-135M-Instruct";
const similarityCeiling = 0.86;

// Allowed enums come straight from the runtime contract so the dataset can
// never drift from config/local-concept.schema.json.
const schema = JSON.parse(
  await readFile(new URL("../config/local-concept.schema.json", import.meta.url), "utf8"),
);
const allowedMoods = new Set(schema.properties.mood.enum);
const allowedFields = new Set(schema.properties.requiredFields.items.enum);
const tokenEnums = Object.fromEntries(
  Object.entries(schema.properties.designTokens.properties)
    .filter(([, definition]) => Array.isArray(definition.enum))
    .map(([key, definition]) => [key, new Set(definition.enum)]),
);

// ---------------------------------------------------------------------------
// Fictional brand pools. Authored for this dataset; none are real businesses.
// Train, validation, and test pools are disjoint by name.
// ---------------------------------------------------------------------------

function b(businessName, industry, primaryColor, secondaryColor, tone, assets, fields) {
  return {
    businessName,
    industry,
    primaryColor,
    secondaryColor,
    tone,
    assets: assets ? assets.split(",") : [],
    fields: fields.split(","),
  };
}

const trainBrands = [
  b("Tidegate Freight Co", "Port logistics", "#0f3b57", "#f2a33c", "industrial,precise", "logo,hero", "tier,expiryDate"),
  b("Quillstone Press Guild", "Journalism cooperative", "#27364b", "#c9a227", "sober,investigative", "logo", "tier,email"),
  b("Briarfield Parks", "Municipal recreation", "#1d6f42", "#f4d35e", "civic,welcoming", "logo,background", "expiryDate,dateJoined"),
  b("Voltline Registry", "Trade licensing", "#123a6b", "#e8eef7", "regulated,exact", "logo", "tier,expiryDate"),
  b("Sisterhouse Clinic", "Community health", "#7a1f3d", "#f5e6ec", "caring,clinical", "logo,hero", "phone,expiryDate"),
  b("Vellum & Verdigris", "Rare archive", "#3e4e3a", "#b9a47e", "archival,hushed", "logo", "expiryDate,email"),
  b("Crossrail Collective", "Transit advocacy", "#b03a2e", "#1c2833", "civic,kinetic", "logo,background", "tier,expiryDate"),
  b("Granite Works Bureau", "Public works", "#4a5568", "#d97706", "sturdy,municipal", "hero,background", "tier,phone"),
  b("Seal & Cipher Chamber", "Notarial services", "#1f2d3d", "#8c7851", "formal,exact", "", "email,expiryDate"),
  b("Gatehouse Forty", "Security services", "#2c3539", "#c0c8d0", "vigilant,procedural", "logo", "tier,expiryDate"),
  b("Foglight Atelier", "Architecture studio", "#30343f", "#e2e4e9", "spare,exacting", "logo,hero", "tier,email"),
  b("Steeplow Tea Rooms", "Tea house", "#4e6151", "#d9c8b4", "calm,handcrafted", "logo", "loyaltyPoints,tier"),
  b("Hollow Reed Studio", "Meditation space", "#5b6c5d", "#ecebe4", "still,gentle", "", "expiryDate,tier"),
  b("Deskfield Commons", "Coworking space", "#22577a", "#ffcf56", "modular,open", "logo,background", "tier,email"),
  b("Grotesk Hall", "Typography guild", "#111111", "#f53b57", "graphic,exact", "logo", "dateJoined,tier"),
  b("Folio & Sons", "Design bookshop", "#28536b", "#c2948a", "editorial,curated", "logo,hero,background", "loyaltyPoints,email"),
  b("Slipware House", "Pottery studio", "#9c6644", "#f3e9dc", "earthen,patient", "logo,hero", "dateJoined,tier"),
  b("Wax Cylinder Archive", "Sound archive", "#463f3a", "#bcb8b1", "archival,analog", "", "email,expiryDate"),
  b("Ninthbed Capsules", "Capsule hotel", "#2b2d42", "#ef8354", "compact,nocturnal", "logo,background", "tier,email"),
  b("Crucible Bench Labs", "Materials research", "#0b3954", "#bfd7ea", "empirical,exact", "logo", "expiryDate,phone"),
  b("Plumbline Strength", "Minimalist gym", "#1a1a2e", "#e94560", "disciplined,bare", "logo,hero", "tier,dateJoined"),
  b("Deckle Edge Paperworks", "Stationery atelier", "#6d597a", "#eaac8b", "tactile,crafted", "logo", "loyaltyPoints,tier"),
  b("Sonata Row", "Chamber music society", "#432818", "#bb9457", "lyrical,intimate", "logo,hero", "tier,expiryDate"),
  b("Kannon Bonsai Circle", "Bonsai club", "#344e41", "#dad7cd", "patient,seasonal", "logo", "dateJoined,tier"),
  b("Mainspring Society", "Watch collectors", "#14213d", "#fca311", "mechanical,precise", "logo,background", "tier,expiryDate"),
  b("Vantage Forty Lounge", "Rooftop lounge", "#1b1b3a", "#d4af37", "elevated,nocturnal", "logo,hero,background", "tier,loyaltyPoints"),
  b("Velvet Hour Cinema", "Private cinema", "#2d132c", "#ee4540", "cinematic,plush", "logo,hero", "tier,expiryDate"),
  b("Barrelline Cellars", "Wine cellar", "#4a1c2f", "#c89f7a", "aged,reserved", "logo,hero", "tier,loyaltyPoints"),
  b("Dawnside Links", "Golf club", "#2d5234", "#e9c46a", "verdant,unhurried", "hero,background", "tier,dateJoined"),
  b("Meridian Keys Travel", "Travel concierge", "#003049", "#eae2b7", "worldly,attentive", "logo", "phone,email"),
  b("Stillwater Bathhouse", "Spa retreat", "#5f7470", "#e8ddb5", "serene,mineral", "logo,hero", "tier,expiryDate"),
  b("Charline Counter", "Chef's counter dining", "#581845", "#ffc300", "culinary,exacting", "logo,background", "tier,loyaltyPoints"),
  b("Curtainfall Circle", "Opera patrons", "#1d1135", "#c06c84", "operatic,gilded", "logo,hero", "tier,expiryDate"),
  b("Halyard Basin Club", "Marina", "#023e58", "#f18f01", "maritime,trim", "logo,hero,background", "tier,expiryDate"),
  b("Lapidary Row", "Jewelry atelier", "#2f2235", "#cdb4db", "faceted,precise", "logo", "email,tier"),
  b("Aerolith Club", "Airline lounge program", "#16324f", "#fcd757", "ascendant,polished", "logo,background", "tier,loyaltyPoints"),
  b("Quarto Reading Society", "Subscription library", "#5e503f", "#eae0d5", "bookish,quiet", "logo", "dateJoined,tier"),
  b("Coppervault Drams", "Whisky vault", "#3a2618", "#d9a566", "smoky,bonded", "logo,background", "tier,loyaltyPoints"),
  b("Silverline Motors", "Chauffeur service", "#1c1c1c", "#bdc3c7", "discreet,punctual", "", "phone,tier"),
  b("Crowsfoot Athletic", "Penthouse fitness", "#22223b", "#9a8c98", "executive,strong", "logo,hero", "tier,expiryDate"),
  b("Meeple Royale", "Board-game cafe", "#d1495b", "#30638e", "playful,strategic", "logo", "tier,loyaltyPoints"),
  b("Skybounce Yards", "Trampoline park", "#ff6b35", "#004e89", "springy,loud", "logo,hero", "expiryDate,phone"),
  b("Twin Churn Creamery", "Ice cream collective", "#ff70a6", "#fff3b0", "sweet,sunny", "logo,background", "loyaltyPoints,tier"),
  b("Muddy Paws Yard", "Dog daycare", "#6a994e", "#fdc500", "waggish,outdoors", "logo,hero", "phone,tier"),
  b("Inkpanel Comics", "Comic shop", "#5f0f40", "#fb8b24", "illustrated,fandom", "logo,hero,background", "loyaltyPoints,dateJoined"),
  b("Windmill Eighteen", "Mini-golf league", "#0f7b6c", "#f4a259", "breezy,competitive", "logo", "tier,loyaltyPoints"),
  b("Coin-Op Cathedral", "Arcade", "#240046", "#ff6d00", "neon,nostalgic", "logo,background", "loyaltyPoints,tier"),
  b("Beaker Brigade", "Children's science club", "#1982c4", "#ffca3a", "curious,bright", "logo", "tier,phone"),
  b("Pearl Posse Teahouse", "Bubble tea bar", "#8338ec", "#ffbe0b", "chewy,upbeat", "logo,hero", "loyaltyPoints,tier"),
  b("Offkey Palace", "Karaoke house", "#d81159", "#218380", "vocal,festive", "logo,background", "tier,expiryDate"),
  b("Tailwind Kites", "Kite society", "#118ab2", "#ffd166", "airborne,light", "hero,background", "dateJoined,tier"),
  b("Splashworks Park", "Waterpark", "#0096c7", "#ffe169", "splashy,summer", "logo,hero", "expiryDate,tier"),
  b("Tilt & Nudge League", "Pinball league", "#390099", "#ff5400", "kinetic,retro", "logo", "tier,loyaltyPoints"),
  b("Whisker Parlor", "Cat lounge", "#936639", "#fff1e6", "purring,cozy", "logo,hero", "dateJoined,loyaltyPoints"),
  b("Heliumworks Museum", "Balloon museum", "#ef476f", "#ffd166", "buoyant,whimsical", "logo,hero,background", "tier,expiryDate"),
  b("Tenpenny Studios", "Artist co-op", "#283d3b", "#edddd4", "collective,raw", "logo,background", "tier,dateJoined"),
  b("Staple & Fold", "Zine library", "#1c1c1c", "#ffe66d", "photocopied,defiant", "logo", "loyaltyPoints,expiryDate"),
  b("Reel Cellar Collective", "Film collective", "#0d1321", "#ee6c4d", "cinephile,underground", "logo,hero", "tier,expiryDate"),
  b("Scaffold City Crew", "Mural collective", "#f72585", "#3a0ca3", "bold,street", "logo,hero,background", "tier,expiryDate"),
  b("Sorts & Slugs Press", "Letterpress guild", "#2b2118", "#c44536", "inked,tactile", "logo", "dateJoined,tier"),
  b("Fallowfield Residency", "Arts residency", "#606c38", "#fefae0", "pastoral,devoted", "hero,background", "tier,email"),
  b("Amber Bath Darkroom", "Community darkroom", "#1a120b", "#e5a00d", "analog,patient", "logo", "tier,expiryDate"),
  b("Black Shutter Theatre", "Experimental theatre", "#10002b", "#e0aaff", "experimental,stark", "logo,background", "expiryDate,tier"),
  b("Oscillon Lab", "Sound-art lab", "#03045e", "#00f5d4", "sonic,modular", "logo,background", "tier,loyaltyPoints"),
  b("Ashglaze Works", "Ceramics collective", "#582f0e", "#ddb892", "kiln-fired,communal", "logo,hero,background", "loyaltyPoints,dateJoined"),
  b("Bitloom Collective", "Indie game collective", "#3c096c", "#80ffdb", "pixelated,inventive", "logo", "tier,email"),
  b("Low Tide Verses", "Poetry society", "#1d3557", "#f1faee", "lyric,spare", "logo", "tier,dateJoined"),
  b("Selvedge Lab", "Fashion lab", "#463239", "#f6bd60", "tailored,experimental", "logo,hero", "tier,email"),
  b("Keyframe Union", "Animation guild", "#144552", "#f9c74f", "animated,exact", "logo,background", "tier,email"),
  b("Cinder Yard Forge", "Sculpture yard", "#353535", "#ff7b00", "industrial,molten", "hero,background", "tier,phone"),
  b("Overcharge Arena", "Esports arena", "#0b090a", "#00f0ff", "electric,competitive", "logo,hero,background", "tier,expiryDate"),
  b("Parallax Bay", "VR arcade", "#10002b", "#ff9e00", "immersive,charged", "logo,background", "tier,loyaltyPoints"),
  b("Chromewave Hall", "Synthwave club", "#240046", "#ff3cac", "neon,nocturnal", "logo,hero", "tier,dateJoined"),
  b("Solderline Works", "Hardware makerspace", "#001219", "#94d2bd", "soldered,inventive", "logo", "tier,phone"),
  b("Updraft Circuit", "Drone racing league", "#001845", "#33a1fd", "aerial,fast", "logo,hero", "tier,expiryDate"),
  b("Gearteeth League", "Robotics league", "#2f3e46", "#ff9f1c", "mechanical,scrappy", "logo,background", "tier,expiryDate"),
  b("Lanline Lounge", "LAN gaming lounge", "#03071e", "#3bf4fb", "wired,nocturnal", "logo", "tier,loyaltyPoints"),
  b("Substrata Bunker", "Immersive art venue", "#161a1d", "#a4133c", "subterranean,sensory", "hero,background", "expiryDate,tier"),
  b("Pressure Door Club", "Techno club", "#0d0d0d", "#39ff14", "pulsing,minimal", "logo,background", "tier,dateJoined"),
  b("Nightspoke Couriers", "Courier collective", "#14213d", "#fca311", "swift,nocturnal", "logo", "phone,email"),
  b("Lumen Stalls Theatre", "Holographic theatre", "#220135", "#26ffe6", "projected,futurist", "logo,hero", "tier,expiryDate"),
  b("Patchpoint Society", "Modular synth society", "#1b263b", "#fb5607", "patched,analog", "logo,background", "loyaltyPoints,tier"),
  b("Sodium Lane Market", "Night market", "#1f1300", "#ffb627", "lantern-lit,bustling", "hero,background", "tier,expiryDate"),
  b("Dish Array Watch", "Radio astronomy society", "#0d1b2a", "#7df9ff", "signal,patient", "", "tier,expiryDate"),
  b("Pistonhead Diner", "Robot-themed diner", "#2b2d42", "#ef233c", "chromed,kitsch", "logo,hero", "loyaltyPoints,tier"),
  b("Aldergate University", "University", "#13315c", "#eec643", "collegiate,storied", "logo,hero,background", "studentId,course"),
  b("Tensor Hall Faculty", "Engineering faculty", "#1f363d", "#ffa62b", "applied,rigorous", "logo,background", "studentId,course"),
  b("Rostrum Union", "Debate union", "#470024", "#e3b505", "rhetorical,formal", "logo", "tier,expiryDate"),
  b("Reagent Row Labs", "Chemistry department", "#283618", "#fefae0", "measured,safe", "logo", "studentId,course"),
  b("Elmgate Alumni Trust", "Alumni association", "#2c1320", "#d9bf77", "nostalgic,loyal", "logo,hero", "dateJoined,tier"),
  b("Solstice Term School", "Summer school", "#f77f00", "#003049", "seasonal,studious", "logo,hero", "course,phone"),
  b("Meadowline Institute", "Research institute", "#335c67", "#e09f3e", "scholarly,calm", "logo", "tier,email"),
  b("Lingua Atrium", "Language center", "#5f0a87", "#ffd60a", "multilingual,bright", "logo,background", "course,loyaltyPoints"),
  b("Aperture Dome Society", "Student astronomy society", "#03045e", "#caf0f8", "stargazing,patient", "logo", "studentId,loyaltyPoints"),
  b("Vesalius Wing", "Medical school", "#14746f", "#f1f7ee", "clinical,exact", "logo,background", "studentId,course"),
  b("Proctor Hall", "Examinations office", "#3d348b", "#f7b801", "procedural,strict", "logo", "studentId,expiryDate"),
  b("Brackwater Station", "Coastal field station", "#0b525b", "#e4c5af", "tidal,fieldworn", "hero,background", "course,phone"),
  b("Laurelmark Scholars", "Scholarship program", "#4a4e69", "#c9ada7", "meritous,quiet", "logo", "tier,studentId"),
  b("Servo Society", "University robotics team", "#1d2d44", "#fe7f2d", "built,iterative", "logo,background", "tier,studentId"),
  b("Glossarium Circle", "Faculty reading circle", "#432534", "#c9b79c", "annotated,scholarly", "logo", "tier,dateJoined"),
];

const validationBrands = [
  b("Harrowgate Assay", "Audit bureau", "#2e3440", "#bf616a", "exacting,plain", "logo", "expiryDate,email"),
  b("Cloudbreak Surf Co-op", "Surf cooperative", "#006494", "#f9a03f", "saltwater,communal", "logo,hero", "tier,dateJoined"),
  b("Mosslight Conservatory", "Botanical conservatory", "#155d27", "#f9f7f3", "verdant,hushed", "logo,hero,background", "tier,expiryDate"),
  b("Tinwhistle Hall", "Folk music hall", "#6f1d1b", "#ffe6a7", "folksy,warm", "logo", "tier,loyaltyPoints"),
  b("Ferrochrome Spin", "Cycling studio", "#212529", "#ff206e", "driven,rhythmic", "logo,background", "tier,expiryDate"),
  b("Wendell & Pike", "Members' club", "#1b1b2f", "#b68d40", "clubbable,discreet", "logo,hero", "tier,expiryDate"),
  b("Drift Bottle Society", "Letter-writing society", "#33658a", "#f6ae2d", "epistolary,wistful", "", "dateJoined,loyaltyPoints"),
  b("Kilnhouse Eight", "Pottery school", "#7f4f24", "#ede0d4", "handbuilt,patient", "logo,hero", "course,tier"),
  b("Northglass Observatory", "Public observatory", "#0b132b", "#6fffe9", "celestial,exact", "logo,background", "tier,expiryDate"),
  b("Brassbell Swim", "Swim center", "#05668d", "#f0f3bd", "buoyant,civic", "logo", "tier,expiryDate"),
  b("Paperlane Bindery", "Bookbinding studio", "#4e3d42", "#dec5a4", "bound,tactile", "logo", "loyaltyPoints,dateJoined"),
  b("Coyote Flats Range", "Archery range", "#54442b", "#e0c879", "steady,outdoor", "logo,hero", "tier,expiryDate"),
  b("Marrow & Rind", "Charcuterie club", "#6b2737", "#e3d081", "cured,convivial", "logo", "loyaltyPoints,tier"),
  b("Switchyard Nine", "Model railway society", "#37423d", "#e07a5f", "scaled,meticulous", "logo,background", "dateJoined,tier"),
  b("Glacier Mile Lodge", "Alpine lodge", "#1d3461", "#fffbdb", "alpine,remote", "hero,background", "tier,expiryDate"),
  b("Cobalt Reef Aquarium", "Aquarium society", "#023047", "#8ecae6", "submerged,wondrous", "logo,hero", "tier,phone"),
  b("Halftone Forum", "Print collective", "#222222", "#f25f5c", "printed,communal", "logo", "tier,email"),
  b("Saffron Step Dance", "Dance school", "#9d0208", "#ffba08", "rhythmic,joyful", "logo,hero", "course,tier"),
  b("Quietwater Anglers", "Fishing club", "#2d6a4f", "#d8f3dc", "riverine,patient", "", "tier,dateJoined"),
  b("Forge & Filament", "Maker collective", "#463f3a", "#f4a261", "built,curious", "logo,background", "tier,phone"),
  b("Lanternfield Fair", "Seasonal fair", "#581c0c", "#ffb703", "festive,golden", "logo,hero,background", "tier,expiryDate"),
  b("Atlas Verge Expeditions", "Hiking expeditions", "#283618", "#dda15e", "trail-worn,bold", "hero", "tier,phone"),
  b("Minim & Stave", "Choir school", "#102542", "#f87060", "choral,bright", "logo", "course,email"),
  b("Copperplate Salon", "Calligraphy salon", "#3c1518", "#d6ce93", "inked,elegant", "logo", "loyaltyPoints,tier"),
  b("Skylarking Aero Club", "Gliding club", "#0353a4", "#ffd23f", "soaring,exact", "logo,hero", "tier,expiryDate"),
];

const testBrands = [
  b("Bellfound Foundry", "Bell foundry tours", "#432818", "#e1ce7a", "cast,resonant", "logo,hero", "tier,expiryDate"),
  b("Driftwood Sauna Co", "Coastal sauna", "#283d3b", "#f5cb5c", "steamed,elemental", "logo,background", "tier,loyaltyPoints"),
  b("Nightjar Listening Bar", "Listening bar", "#0f0e0e", "#c08552", "vinyl,hushed", "logo,hero", "tier,dateJoined"),
  b("Penumbra Planetarium", "Planetarium", "#03012d", "#9bf6ff", "cosmic,quiet", "logo,hero,background", "tier,expiryDate"),
  b("Hopfield Mile", "Brewery taproom", "#3a5a40", "#f2cc8f", "hopped,neighborly", "logo,background", "loyaltyPoints,tier"),
  b("Ironquill Fencing", "Fencing salle", "#1b1b1e", "#d8315b", "bladed,disciplined", "logo", "tier,course"),
  b("Madder & Loom", "Weaving guild", "#7b2d26", "#f1e3d3", "dyed,woven", "logo,hero", "dateJoined,loyaltyPoints"),
  b("Vapor Trail Skate", "Skatepark collective", "#14080e", "#49f2c2", "concrete,loose", "logo,hero,background", "tier,dateJoined"),
  b("Crowline Sail School", "Sailing school", "#003559", "#ffc49b", "rigged,salt-bright", "logo,hero", "course,tier"),
  b("Ember & Anvil", "Blacksmith school", "#2f1b0c", "#ff8800", "forged,deliberate", "logo", "course,phone"),
  b("Gildersleeve Hotel", "Heritage hotel", "#1f2041", "#ffc857", "storied,gilded", "logo,hero,background", "tier,expiryDate"),
  b("Wolfnote Conservatory", "Music conservatory", "#2e1f27", "#cba135", "tuned,devoted", "logo", "studentId,course"),
  b("Bramblewick Apiary", "Beekeeping cooperative", "#594a26", "#ffd95c", "humming,golden", "logo,hero", "tier,dateJoined"),
  b("Periscope Club", "Submarine museum club", "#0a2342", "#2ca58d", "nautical,curious", "logo,background", "tier,expiryDate"),
  b("Saltflat Riders", "Land-speed club", "#b56a28", "#f0ebd8", "horizon-flat,fast", "hero,background", "tier,phone"),
  b("Vine & Volley", "Padel club", "#0c3823", "#c5f547", "energetic,social", "logo,hero", "tier,expiryDate"),
  b("Archive of Small Hours", "Insomnia reading room", "#191923", "#aab9cf", "nocturnal,gentle", "", "expiryDate,email"),
  b("Pepperbox Kitchen", "Cooking school", "#7c0b2b", "#ffba49", "spiced,hands-on", "logo,background", "course,loyaltyPoints"),
  b("Cloudloom VFX Guild", "VFX guild", "#161b33", "#5bc8af", "rendered,technical", "logo", "tier,email"),
  b("Harborlight Rescue", "Volunteer marine rescue", "#c1292e", "#f1d302", "vigilant,seaworthy", "logo,hero", "tier,phone"),
  b("Gravelglass Distillery", "Distillery circle", "#2d2a32", "#ddb967", "distilled,patient", "logo,background", "loyaltyPoints,tier"),
  b("Fernhollow Trails", "Trail-running club", "#344e41", "#a3b18a", "rooted,enduring", "hero", "tier,dateJoined"),
  b("Brightwater Lido", "Open-air lido", "#0077b6", "#ffd60a", "sunlit,communal", "logo,hero", "tier,expiryDate"),
  b("Inkfathom Tattoo Guild", "Tattoo guild", "#101010", "#00b4d8", "inked,exacting", "logo,hero", "tier,email"),
  b("Stonebridge Chess Hall", "Chess hall", "#3d405b", "#f2cc8f", "strategic,quiet", "logo", "tier,loyaltyPoints"),
];

// ---------------------------------------------------------------------------
// Deterministic helpers.
// ---------------------------------------------------------------------------

function hashInt(value) {
  return Number.parseInt(createHash("sha256").update(value).digest("hex").slice(0, 8), 16);
}

function seededShuffle(values, seed, identity) {
  return [...values]
    .map((value) => ({ value, order: hashInt(`${seed}:${identity(value)}`) }))
    .sort((a, b) => a.order - b.order || identity(a.value).localeCompare(identity(b.value)))
    .map(({ value }) => value);
}

function articleFor(word) {
  return /^[aeiou]/i.test(word) ? "An" : "A";
}

const affinityRules = [
  {
    key: "official-civic",
    scenario: /\b(civic|court|government|municipal|public|registry|license|licensing|security|official|audit|inspection|inspector|notary|notarial|hospital|ward|election|clearance|permit|credential|authority|staff)\b/i,
    brand: /\b(audit|bureau|civic|clinic|faculty|government|health|hospital|institute|licensing|logistics|municipal|notarial|office|public|registry|rescue|security|standards|trade|transit|university|works)\b/i,
  },
  {
    key: "education-academic",
    scenario: /\b(academic|alumni|campus|course|exam|faculty|library|research|scholar|school|student|university)\b/i,
    brand: /\b(academic|alumni|archive|astronomy|chemistry|college|debate|department|education|examinations|faculty|institute|language|library|medical school|research|scholar|school|society|university)\b/i,
  },
  {
    key: "food-hospitality",
    scenario: /\b(bar|cafe|coffee|concierge|dining|drink|guest|hospitality|hotel|kitchen|loyalty|lounge|patron|restaurant|rewards|tea|vip)\b/i,
    brand: /\b(bar|bathhouse|cafe|cellar|cinema|creamery|diner|dining|distillery|hotel|kitchen|lounge|restaurant|retreat|spa|tea|teahouse|taproom|whisky|wine)\b/i,
  },
  {
    key: "sports-outdoor",
    scenario: /\b(athletic|clubhouse|coach|court|fitness|gym|league|outdoor|pool|race|sport|team|training|trail)\b/i,
    brand: /\b(archery|athletic|cycling|expedition|fencing|fitness|golf|gym|hiking|league|lido|marina|padel|park|range|riders|running|sailing|skate|sports|surf|swim|trails)\b/i,
  },
  {
    key: "maritime-transport",
    scenario: /\b(coastal|dock|freight|harbor|marina|marine|port|sail|ship|transit|transport|water-treatment)\b/i,
    brand: /\b(coastal|courier|freight|harbor|logistics|marina|marine|rail|rescue|sailing|transit|travel|water)\b/i,
  },
  {
    key: "creative-cultural",
    scenario: /\b(art|artist|archive|cinema|collectible|creative|editorial|exhibition|gallery|illustration|magazine|museum|patron|portfolio|poster|studio|theatre)\b/i,
    brand: /\b(animation|archive|art|atelier|bindery|book|ceramic|cinema|collective|comics|conservatory|creative|darkroom|design|fashion|film|forge|gallery|guild|museum|paper|poetry|press|print|residency|sculpture|studio|tattoo|theatre|typography|vfx|weaving)\b/i,
  },
  {
    key: "technology-gaming",
    scenario: /\b(access token|arcade|cyber|digital|drone|esports|futur|game|gaming|holographic|maker|neon|robot|system|technical|technology|vr)\b/i,
    brand: /\b(arcade|circuit|drone|esports|game|gaming|hardware|holographic|lab|makerspace|robot|robotics|synth|technology|vfx|vr)\b/i,
  },
  {
    key: "event-entertainment",
    scenario: /\b(attendee|badge|concert|conference|entry|event|festival|lanyard|music|performance|ticket|venue)\b/i,
    brand: /\b(arena|cinema|club|fair|hall|karaoke|market|music|opera|society|theatre|venue)\b/i,
  },
  {
    key: "wellness-community",
    scenario: /\b(calm|community|meditation|member services|quiet|retreat|social|volunteer|wellness|welcoming|yoga)\b/i,
    brand: /\b(bathhouse|clinic|community|co-op|cooperative|meditation|nursery|retreat|society|spa|tea|volunteer|wellness|yoga)\b/i,
  },
  {
    key: "professional-network",
    scenario: /\b(contact|employee|member network|networking|professional|registry|staff|trade)\b/i,
    brand: /\b(association|bureau|collective|council|faculty|guild|institute|network|registry|services|studio|trade|union)\b/i,
  },
];

const exactFieldPrompt =
  /\b(scan alone|exactly what (?:a|the) [^.;]+ needs|strip the (?:email|phone|member|personal)|remove every (?:detail|field)|verification continues through the code and expiry alone|only (?:the )?(?:essential|critical|required|verification) (?:data|details|fields|information)|minimum (?:data|information)|bare essentials|no unnecessary (?:details|fields|information)|without extra fields)\b/i;

function scenarioText(scenario) {
  return `${scenario.mood} ${scenario.prompt} ${scenario.summary} ${scenario.label}`;
}

function brandText(brand) {
  return `${brand.businessName} ${brand.industry} ${brand.tone}`;
}

function scenarioFieldPolicy(scenario) {
  return exactFieldPrompt.test(scenario.prompt) ? "exact" : "merge";
}

function matchingCategories(scenario, brand) {
  const prompt = scenarioText(scenario);
  const description = brandText(brand);
  return affinityRules
    .filter((rule) => rule.scenario.test(prompt) && rule.brand.test(description))
    .map((rule) => rule.key);
}

function brandCompatibility(brand, scenario) {
  const categories = matchingCategories(scenario, brand);
  const preferredAssetMatch =
    scenario.preferredAsset === "none"
      ? brand.assets.length === 0
      : brand.assets.includes(scenario.preferredAsset);
  const fieldOverlap = scenario.fields.filter((field) => brand.fields.includes(field)).length;
  const promptTokens = new Set(scenarioText(scenario).toLowerCase().match(/[a-z0-9-]+/g) ?? []);
  const lexicalOverlap = new Set(
    (brandText(brand).toLowerCase().match(/[a-z0-9-]+/g) ?? []).filter((token) =>
      promptTokens.has(token),
    ),
  ).size;

  return {
    score:
      categories.length * 12 +
      (scenario.preferredAsset === "none"
        ? brand.assets.length === 0
          ? 24
          : -12
        : Number(preferredAssetMatch) * 8) +
      fieldOverlap * 3 +
      Math.min(lexicalOverlap, 3),
    categories,
    preferredAssetMatch,
    fieldOverlap,
  };
}

// ---------------------------------------------------------------------------
// Expected-concept derivation.
// ---------------------------------------------------------------------------

const assetFallbacks = {
  logo: ["logo", "background", "hero"],
  hero: ["hero", "background", "logo"],
  background: ["background", "hero", "logo"],
};

function resolveAssetSource(brand, preferred) {
  if (preferred === "none") return "none";
  for (const candidate of assetFallbacks[preferred]) {
    if (brand.assets.includes(candidate)) return candidate;
  }
  return "none";
}

function resolveTreatment(source, requested) {
  if (source === "none") return "standard";
  if (source === "logo" && requested === "hero-backdrop") return "background-emblem";
  if (source !== "logo" && requested === "logo-watermark") return "hero-backdrop";
  return requested;
}

function resolveBackground(source, requested, colorUsage) {
  if (source === "none" && (requested === "image" || requested === "image-overlay")) {
    return ["dominant", "full"].includes(colorUsage) ? "gradient" : "solid";
  }
  return requested;
}

function buildRequiredFields(brand, scenario) {
  const removed = new Set(scenario.removeFields);
  const brandFields = scenarioFieldPolicy(scenario) === "exact" ? [] : brand.fields.slice(0, 2);
  const ordered = [
    ...lockedFields,
    ...(scenario.usesPhoto ? ["photo"] : []),
    ...(scenario.usesDecorativeArt ? ["decorativeArt"] : []),
    ...scenario.fields,
    ...brandFields,
  ];
  return [...new Set(ordered)]
    .filter((field) => allowedFields.has(field) && !removed.has(field))
    .slice(0, 8);
}

function expectedConcept(brand, scenario, id) {
  const source = resolveAssetSource(brand, scenario.preferredAsset);
  const backgroundMode = resolveBackground(source, scenario.backgroundMode, scenario.colorUsage);
  const requiredFields = buildRequiredFields(brand, scenario);
  const tones = brand.tone.split(",").slice(0, 2);
  const lightText =
    ["dominant", "full"].includes(scenario.colorUsage) ||
    ["image", "image-overlay"].includes(backgroundMode);

  return {
    id,
    name: `${brand.businessName} ${scenario.label}`,
    description: `${articleFor(scenario.mood)} ${scenario.mood} ${scenario.summary} for ${brand.businessName}, tuned to its ${tones.join(", ")} voice.`,
    mood: scenario.mood,
    requiredFields,
    designTokens: {
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      textColor: lightText ? "#ffffff" : "#1f2937",
      orientation: scenario.orientation,
      backgroundMode,
      colorUsage: scenario.colorUsage,
      brandAssetSource: source,
      brandAssetTreatment: resolveTreatment(source, scenario.treatment),
      brandAssetIntensity: source === "none" ? "subtle" : scenario.intensity,
      usesLogo: brand.assets.includes("logo"),
      usesQr: true,
      usesPhoto: requiredFields.includes("photo"),
      usesDecorativeArt: requiredFields.includes("decorativeArt"),
    },
  };
}

// ---------------------------------------------------------------------------
// Prompt construction.
// ---------------------------------------------------------------------------

function brandLine(brand) {
  return [
    `brand=${brand.businessName}`,
    `industry=${brand.industry}`,
    `colors=${brand.primaryColor},${brand.secondaryColor}`,
    `tone=${brand.tone}`,
    `assets=${brand.assets.join(",") || "none"}`,
  ].join("; ");
}

const moodList = [...allowedMoods];
const currentBackgrounds = ["solid", "gradient", "pattern", "image-overlay"];

function currentStateLine(brand, scenario) {
  const override = scenario.current ?? {};
  const seed = `sv5-current:${scenario.key}:${brand.businessName}`;
  const otherMoods = moodList.filter((mood) => mood !== scenario.mood);
  const mood = override.mood ?? otherMoods[hashInt(`${seed}:mood`) % otherMoods.length];
  const orientation =
    override.orientation ?? (hashInt(`${seed}:orientation`) % 2 === 0 ? "landscape" : "portrait");
  const backgroundMode =
    override.backgroundMode ??
    currentBackgrounds[hashInt(`${seed}:background`) % currentBackgrounds.length];
  const lacks = new Set(override.lacks ?? []);
  const fields = [
    ...lockedFields,
    ...scenario.removeFields,
    ...(override.has ?? []),
    ...brand.fields.slice(0, 2),
  ];
  const currentFields = [...new Set(fields)].filter((field) => !lacks.has(field)).slice(0, 8);
  return [mood, orientation, backgroundMode, ...currentFields].join(",");
}

function makeExample(brand, scenario, id) {
  const parts = [`id=${id}`, brandLine(brand)];
  if (scenario.task === "refinement") {
    parts.push(`current=${currentStateLine(brand, scenario)}`);
    parts.push(`refine=${scenario.prompt}`);
  } else {
    parts.push(`direction=${scenario.prompt}`);
  }
  const expected = expectedConcept(brand, scenario, id);
  validateConcept(expected);
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: parts.join("; ") },
      { role: "assistant", content: JSON.stringify(expected) },
    ],
    metadata: {
      task: scenario.task,
      mood: scenario.mood,
      brand: brand.businessName,
      industry: brand.industry,
      scenario: scenario.key,
      fieldPolicy: scenarioFieldPolicy(scenario),
      brandCompatibility: brandCompatibility(brand, scenario),
      expected,
    },
  };
}

// ---------------------------------------------------------------------------
// Split assembly: 250/25/25 scenarios, 10 brand expansions per scenario.
// ---------------------------------------------------------------------------

function buildScenarioSplits() {
  const splits = { train: [], validation: [], test: [] };
  for (const [moodIndex, mood] of moodList.entries()) {
    const generation = seededShuffle(
      scenarioV5Scenarios.filter((s) => s.mood === mood && s.task === "generation"),
      `sv5-split-${mood}-generation`,
      (s) => s.key,
    );
    const refinement = seededShuffle(
      scenarioV5Scenarios.filter((s) => s.mood === mood && s.task === "refinement"),
      `sv5-split-${mood}-refinement`,
      (s) => s.key,
    );
    const refinementValidation = moodIndex % 2 === 0 ? 1 : 2;
    splits.train.push(...generation.slice(0, 13), ...refinement.slice(0, 12));
    splits.validation.push(
      ...generation.slice(13, 14),
      ...refinement.slice(12, 12 + refinementValidation),
    );
    splits.test.push(
      ...generation.slice(14),
      ...refinement.slice(12 + refinementValidation),
    );
  }
  return splits;
}

function buildSplitRows(scenarios, brands, split) {
  const rows = [];
  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    const scenarioBrands = [...brands]
      .map((brand) => ({
        brand,
        compatibility: brandCompatibility(brand, scenario),
        tieBreaker: hashInt(`sv5-brands:${split}:${scenario.key}:${brand.businessName}`),
      }))
      .sort(
        (left, right) =>
          right.compatibility.score - left.compatibility.score ||
          left.tieBreaker - right.tieBreaker ||
          left.brand.businessName.localeCompare(right.brand.businessName),
      )
      .slice(0, 10)
      .map(({ brand }) => brand);
    for (const [expansionIndex, brand] of scenarioBrands.entries()) {
      const id = `sv5-${split}-${String(scenarioIndex + 1).padStart(3, "0")}-${String(expansionIndex + 1).padStart(2, "0")}`;
      rows.push(makeExample(brand, scenario, id));
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Validation.
// ---------------------------------------------------------------------------

function validateConcept(concept) {
  const fail = (message) => {
    throw new Error(`Invalid concept ${concept.id ?? "?"}: ${message}`);
  };
  if (!concept.id || concept.id.length > 64) fail("bad id");
  if (!concept.name || concept.name.length > 70) fail("bad name");
  if (!concept.description || concept.description.length > 160) fail("bad description");
  if (!allowedMoods.has(concept.mood)) fail(`bad mood ${concept.mood}`);
  if (
    !Array.isArray(concept.requiredFields) ||
    concept.requiredFields.length < 3 ||
    concept.requiredFields.length > 8
  ) {
    fail("requiredFields outside 3..8");
  }
  if (new Set(concept.requiredFields).size !== concept.requiredFields.length) {
    fail("duplicate required field");
  }
  for (const field of lockedFields) {
    if (!concept.requiredFields.includes(field)) fail(`missing locked field ${field}`);
  }
  for (const field of concept.requiredFields) {
    if (!allowedFields.has(field)) fail(`field ${field} not allowed`);
  }
  for (const key of ["primaryColor", "secondaryColor", "textColor"]) {
    if (!/^#[0-9a-fA-F]{6}$/.test(concept.designTokens[key])) fail(`bad ${key}`);
  }
  for (const [key, allowed] of Object.entries(tokenEnums)) {
    if (!allowed.has(concept.designTokens[key])) fail(`bad ${key} ${concept.designTokens[key]}`);
  }
  for (const key of ["usesLogo", "usesQr", "usesPhoto", "usesDecorativeArt"]) {
    if (typeof concept.designTokens[key] !== "boolean") fail(`${key} not boolean`);
  }
  if (concept.designTokens.usesQr !== true) fail("usesQr must be true");
  if (concept.designTokens.usesPhoto !== concept.requiredFields.includes("photo")) {
    fail("usesPhoto inconsistent with photo field");
  }
  if (concept.designTokens.usesDecorativeArt !== concept.requiredFields.includes("decorativeArt")) {
    fail("usesDecorativeArt inconsistent with decorativeArt field");
  }
}

function promptTokens(text) {
  return new Set(text.toLowerCase().match(/[a-z0-9-]+/g) ?? []);
}

function jaccard(left, right) {
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function validateScenarioLibrary() {
  if (scenarioV5Scenarios.length !== 300) throw new Error("expected exactly 300 scenarios");
  const keys = new Set(scenarioV5Scenarios.map((s) => s.key));
  const prompts = new Set(
    scenarioV5Scenarios.map((s) => s.prompt.toLowerCase().replace(/\s+/g, " ").trim()),
  );
  if (keys.size !== 300) throw new Error("duplicate scenario keys");
  if (prompts.size !== 300) throw new Error("duplicate scenario prompts");

  const tokenSets = scenarioV5Scenarios.map((s) => promptTokens(s.prompt));
  let highest = { score: 0, left: "", right: "" };
  for (let i = 0; i < scenarioV5Scenarios.length; i += 1) {
    for (let j = i + 1; j < scenarioV5Scenarios.length; j += 1) {
      const score = jaccard(tokenSets[i], tokenSets[j]);
      if (score > highest.score) {
        highest = { score, left: scenarioV5Scenarios[i].key, right: scenarioV5Scenarios[j].key };
      }
    }
  }
  if (highest.score >= similarityCeiling) {
    throw new Error(
      `scenario prompts too similar (>= ${similarityCeiling}): ${JSON.stringify(highest)}`,
    );
  }
  return highest;
}

function validateBrandPools(pools) {
  const seen = new Set();
  for (const [pool, brands] of Object.entries(pools)) {
    for (const brand of brands) {
      if (seen.has(brand.businessName)) {
        throw new Error(`brand ${brand.businessName} appears in more than one pool`);
      }
      seen.add(brand.businessName);
      if (brand.businessName.length > 26) throw new Error(`${brand.businessName}: name too long`);
      if (brand.industry.length > 50) throw new Error(`${brand.businessName}: industry too long`);
      for (const color of [brand.primaryColor, brand.secondaryColor]) {
        if (!/^#[0-9a-f]{6}$/.test(color)) throw new Error(`${brand.businessName}: bad color`);
      }
      for (const asset of brand.assets) {
        if (!["logo", "hero", "background"].includes(asset)) {
          throw new Error(`${brand.businessName}: bad asset ${asset}`);
        }
      }
      for (const field of brand.fields) {
        if (!allowedFields.has(field) || lockedFields.includes(field) || field === "photo" || field === "decorativeArt") {
          throw new Error(`${brand.businessName}: bad brand field ${field}`);
        }
      }
    }
    if (brands.length < 10) throw new Error(`${pool} pool needs at least 10 brands`);
  }
}

function countBy(values, getter) {
  const counts = {};
  for (const value of values) {
    const key = getter(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function validateSplits(scenarioSplits, brandPools, rowSplits) {
  const expectations = { train: [250, 2500], validation: [25, 250], test: [25, 250] };
  const seenPrompts = new Set();
  const seenIds = new Set();

  for (const [split, [scenarioCount, exampleCount]] of Object.entries(expectations)) {
    const scenarios = scenarioSplits[split];
    const rows = rowSplits[split];
    if (scenarios.length !== scenarioCount) {
      throw new Error(`${split}: expected ${scenarioCount} scenarios, found ${scenarios.length}`);
    }
    if (rows.length !== exampleCount) {
      throw new Error(`${split}: expected ${exampleCount} examples, found ${rows.length}`);
    }
    const perScenario = countBy(rows, (row) => row.metadata.scenario);
    if (Object.keys(perScenario).length !== scenarioCount) {
      throw new Error(`${split}: scenario coverage mismatch`);
    }
    for (const [key, count] of Object.entries(perScenario)) {
      if (count !== 10) throw new Error(`${split}: scenario ${key} expanded ${count} times, not 10`);
    }
    for (const row of rows) {
      const normalized = row.messages[1].content.toLowerCase().replace(/\s+/g, " ").trim();
      if (seenPrompts.has(normalized)) throw new Error(`${split}: duplicate full example prompt`);
      seenPrompts.add(normalized);
      const id = row.metadata.expected.id;
      if (seenIds.has(id)) throw new Error(`${split}: duplicate expected id ${id}`);
      seenIds.add(id);
      validateConcept(row.metadata.expected);
      const colors = row.messages[1].content.match(/colors=(#[0-9a-f]{6}),(#[0-9a-f]{6})/);
      if (!colors || row.metadata.expected.designTokens.primaryColor !== colors[1]) {
        throw new Error(`${split}: ${id} does not preserve the prompt primary color`);
      }
    }
    for (const scenario of scenarios) {
      const brands = new Set(
        rows.filter((row) => row.metadata.scenario === scenario.key).map((row) => row.metadata.brand),
      );
      if (brands.size !== 10) {
        throw new Error(`${split}: scenario ${scenario.key} reuses a brand across expansions`);
      }
      const scenarioRows = rows.filter((row) => row.metadata.scenario === scenario.key);
      const selectedScores = scenarioRows.map((row) => row.metadata.brandCompatibility.score);
      const candidateScores = brandPools[split].map(
        (brand) => brandCompatibility(brand, scenario).score,
      );
      if (Math.min(...selectedScores) < [...candidateScores].sort((a, b) => b - a)[9]) {
        throw new Error(`${split}: scenario ${scenario.key} did not select the best-matching brands`);
      }
    }
    if (split !== "train") {
      const tasks = new Set(scenarios.map((s) => s.task));
      const moods = new Set(scenarios.map((s) => s.mood));
      if (tasks.size !== 2) throw new Error(`${split}: must include generation and refinement`);
      if (moods.size !== allowedMoods.size) throw new Error(`${split}: must include all moods`);
    }
  }

  const splitNames = Object.keys(expectations);
  for (let i = 0; i < splitNames.length; i += 1) {
    for (let j = i + 1; j < splitNames.length; j += 1) {
      const left = splitNames[i];
      const right = splitNames[j];
      const leftScenarios = new Set(scenarioSplits[left].map((s) => s.key));
      const leftBrands = new Set(brandPools[left].map((brand) => brand.businessName));
      if (scenarioSplits[right].some((s) => leftScenarios.has(s.key))) {
        throw new Error(`scenario leakage between ${left} and ${right}`);
      }
      if (brandPools[right].some((brand) => leftBrands.has(brand.businessName))) {
        throw new Error(`brand leakage between ${left} and ${right}`);
      }
      const leftUsed = new Set(rowSplits[left].map((row) => row.metadata.brand));
      if (rowSplits[right].some((row) => leftUsed.has(row.metadata.brand))) {
        throw new Error(`brand usage leakage between ${left} and ${right}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Token-length validation with the real training tokenizer.
// ---------------------------------------------------------------------------

const tokenCheckScript = `
import json, sys
from transformers import AutoTokenizer

model = ${JSON.stringify(tokenizerModel)}
try:
    tokenizer = AutoTokenizer.from_pretrained(model, local_files_only=True)
except Exception:
    tokenizer = AutoTokenizer.from_pretrained(model)

report = {}
for path in sys.argv[1:]:
    lengths = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            messages = json.loads(line)["messages"]
            prompt = tokenizer.apply_chat_template(
                messages[:-1], tokenize=False, add_generation_prompt=True
            )
            completion = messages[-1]["content"] + tokenizer.eos_token
            total = len(tokenizer(prompt, add_special_tokens=False).input_ids) + len(
                tokenizer(completion, add_special_tokens=False).input_ids
            )
            lengths.append(total)
    report[path] = {
        "count": len(lengths),
        "max": max(lengths),
        "average": round(sum(lengths) / len(lengths), 1),
        "over640": sum(1 for value in lengths if value > 640),
    }
print(json.dumps(report))
`;

function pythonBinary() {
  if (process.env.SCENARIO_V5_PYTHON) return process.env.SCENARIO_V5_PYTHON;
  const venvPython = path.resolve(".venv/bin/python");
  return existsSync(venvPython) ? venvPython : "python3";
}

function measureTokenLengths(files) {
  const result = spawnSync(pythonBinary(), ["-", ...files], {
    input: tokenCheckScript,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`token-length check failed: ${result.stderr || result.stdout}`);
  }
  const lines = result.stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]);
}

// ---------------------------------------------------------------------------
// Build, validate, and write.
// ---------------------------------------------------------------------------

const maximumScenarioSimilarity = validateScenarioLibrary();
const brandPools = { train: trainBrands, validation: validationBrands, test: testBrands };
validateBrandPools(brandPools);

const scenarioSplits = buildScenarioSplits();
const rowSplits = {
  train: buildSplitRows(scenarioSplits.train, trainBrands, "train"),
  validation: buildSplitRows(scenarioSplits.validation, validationBrands, "validation"),
  test: buildSplitRows(scenarioSplits.test, testBrands, "test"),
};
validateSplits(scenarioSplits, brandPools, rowSplits);

const dataDir = path.resolve("training/data");
await mkdir(dataDir, { recursive: true });
const outputs = {
  train: path.join(dataDir, "card_design_scenario_v5_train.jsonl"),
  validation: path.join(dataDir, "card_design_scenario_v5_validation.jsonl"),
  test: path.join(dataDir, "card_design_scenario_v5_test.jsonl"),
};

// Stage to temporary files first: nothing final is written until every
// validation (including token budgets) has passed.
const staged = {};
for (const [split, rows] of Object.entries(rowSplits)) {
  const stagedPath = `${outputs[split]}.tmp`;
  await writeFile(stagedPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  staged[split] = stagedPath;
}

let tokenReportRaw;
try {
  tokenReportRaw = measureTokenLengths(Object.values(staged));
} catch (error) {
  await Promise.all(Object.values(staged).map((file) => rm(file, { force: true })));
  throw error;
}

const tokenStats = Object.fromEntries(
  Object.entries(staged).map(([split, stagedPath]) => [split, tokenReportRaw[stagedPath]]),
);
const overBudget = Object.values(tokenStats).reduce((sum, stats) => sum + stats.over640, 0);
if (overBudget > 0) {
  await Promise.all(Object.values(staged).map((file) => rm(file, { force: true })));
  throw new Error(`${overBudget} examples exceed the ${tokenBudget}-token training budget`);
}

for (const [split, stagedPath] of Object.entries(staged)) {
  await rename(stagedPath, outputs[split]);
}

await writeFile(
  path.join(dataDir, "card_design_scenario_v5_scenarios.json"),
  `${JSON.stringify(scenarioV5Scenarios, null, 2)}\n`,
);

const report = {
  version: "scenario-v5",
  generatedAt: new Date().toISOString(),
  tokenizer: tokenizerModel,
  totalExamples: Object.values(rowSplits).flat().length,
  totalDistinctScenarios: scenarioV5Scenarios.length,
  scenarioTasks: countBy(scenarioV5Scenarios, (s) => s.task),
  scenarioMoods: countBy(scenarioV5Scenarios, (s) => s.mood),
  examplesPerScenario: 10,
  maximumScenarioPromptJaccardSimilarity: {
    score: Number(maximumScenarioSimilarity.score.toFixed(3)),
    left: maximumScenarioSimilarity.left,
    right: maximumScenarioSimilarity.right,
  },
  fieldPolicies: countBy(scenarioV5Scenarios, (scenario) => scenarioFieldPolicy(scenario)),
  brandMatching: Object.fromEntries(
    Object.entries(rowSplits).map(([split, rows]) => [
      split,
      {
        averageCompatibilityScore: Number(
          (
            rows.reduce((sum, row) => sum + row.metadata.brandCompatibility.score, 0) /
            rows.length
          ).toFixed(2),
        ),
        categoryMatchedExamples: rows.filter(
          (row) => row.metadata.brandCompatibility.categories.length > 0,
        ).length,
        preferredAssetMatchedExamples: rows.filter(
          (row) => row.metadata.brandCompatibility.preferredAssetMatch,
        ).length,
        exactFieldPolicyExamples: rows.filter((row) => row.metadata.fieldPolicy === "exact").length,
      },
    ]),
  ),
  splits: Object.fromEntries(
    Object.keys(rowSplits).map((split) => [
      split,
      {
        examples: rowSplits[split].length,
        scenarios: scenarioSplits[split].length,
        brands: brandPools[split].length,
        tasks: countBy(scenarioSplits[split], (s) => s.task),
        moods: countBy(scenarioSplits[split], (s) => s.mood),
        tokenLengths: tokenStats[split],
      },
    ]),
  ),
  validation: {
    duplicateScenarioKeys: 0,
    duplicateScenarioPrompts: 0,
    duplicateExamplePrompts: 0,
    duplicateExpectedIds: 0,
    scenarioLeakageAcrossSplits: 0,
    brandLeakageAcrossSplits: 0,
    invalidConcepts: 0,
    missingLockedFields: 0,
    primaryColorMismatches: 0,
    examplesOverTokenBudget: overBudget,
    tokenBudget,
  },
};

await writeFile(
  path.join(dataDir, "card_design_scenario_v5_report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log("Scenario V5 dataset written.");
console.log(
  `Scenarios: ${scenarioV5Scenarios.length} total ` +
    `(${report.scenarioTasks.generation} generation / ${report.scenarioTasks.refinement} refinement), ` +
    "30 per mood, 10 expansions each.",
);
console.log(
  `Splits: train ${rowSplits.train.length}, validation ${rowSplits.validation.length}, ` +
    `test ${rowSplits.test.length}; brand pools ${trainBrands.length}/${validationBrands.length}/${testBrands.length}.`,
);
console.log(
  `Max scenario-prompt Jaccard similarity: ${report.maximumScenarioPromptJaccardSimilarity.score} ` +
    `(${maximumScenarioSimilarity.left} vs ${maximumScenarioSimilarity.right}).`,
);
for (const [split, stats] of Object.entries(tokenStats)) {
  console.log(
    `Token lengths (${split}): max ${stats.max}, average ${stats.average}, over-${tokenBudget} ${stats.over640}.`,
  );
}
