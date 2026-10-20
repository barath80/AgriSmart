export type Stage = {
  stage: string;
  timePeriod: string;
  condition: string;
  activities: string[];
};

export type CropCalendar = {
  key: string;
  name: string;
  stages: Stage[];
};

export const crops: CropCalendar[] = [
  {
    key: 'rice',
    name: 'Rice',
    stages: [
      {
        stage: 'Pre-sowing / Land Preparation',
        timePeriod: '~ 1–2 weeks before sowing',
        condition: 'Field empty (previous crop removed) or fallow; bunds intact; water inlets/outlets ready',
        activities: [
          'Drain/clean field: remove crop residues, weeds, repair bunds/inlets.',
          'Primary tillage: plough 2–3 passes to depth ~10–15 cm.',
          'Secondary tillage/leveling (or puddling if wet irrigation): smooth soil, ensure uniform field surface.',
          'Soil test: check pH, N/P/K/Zn; apply lime if low pH; incorporate FYM/compost/green manure.',
          'Spread/incorporate organic matter (FYM/compost) before sowing/transplanting.',
          'Set up water management: ensure irrigation system works, bunds watertight, field level correct for later uniform water depth.',
        ],
      },
      {
        stage: 'Nursery / Seedling Stage',
        timePeriod: '~ from sowing in nursery to transplanting (if using transplanting method)',
        condition: 'Nursery bed: well-prepared, weed-free, good drainage; seedlings active',
        activities: [
          'Prepare nursery bed: level, remove weeds.',
          'Seed selection: choose high-yielding variety, check germination, treat seeds (fungicide/insecticide) as needed.',
          'Sow seeds in nursery at recommended rate; maintain moisture by light irrigation/ponding.',
          'Nursery maintenance for ~20-30 days (depending variety): keep healthy seedlings.',
          'Hardening: a few days before transplanting reduce water in nursery slightly so seedlings become tougher.',
        ],
      },
      {
        stage: 'Sowing / Transplanting or Direct Seeding',
        timePeriod: 'Sowing/transplanting window (e.g., specific to region/monsoon)',
        condition: 'Either transplanted seedlings (~25–30 days old) or direct-seeded field; soil puddled/leveled (for DSR)',
        activities: [
          'Transplanting route: When seedlings reach ~25-30 days (or variety-specific). Transplant seedlings at spacing (e.g., rows 20–25 cm, plants 15–20 cm apart). Place seedlings at similar depth; after transplanting maintain ~5 cm ponded water once seedlings are established.',
          'Direct Seeding route (DSR): Puddle and level soil; broadcast or drill seeds; lightly cover. First irrigation: after sowing/transplanting ensure adequate water level, maintain field moisture/water depth.',
        ],
      },
      {
        stage: 'Vegetative Growth Stage',
        timePeriod: 'Early weeks after sowing/transplanting until tillering/panicle initiation (varies by variety)',
        condition: 'Plants are in vegetative growth: leaves emerging, tillers starting; water maintained',
        activities: [
          'Water management: if flooded system, maintain ~5-8 cm water depth (or as recommended); in low-water systems ensure soil moisture adequate.',
          'Fertiliser application: first N dose ~10-15 days after transplanting; apply P & K according to soil test.',
          'Weed control: 2–3 weeks after transplanting weed to reduce competition.',
          'Pest/disease scouting: check for stem borers, leafhoppers, nutrient deficiency (yellowing, stunted growth).',
          'Ensure field level/uniform water: refill water if depth lost; maintain bunds; check for water leaks or uneven water.',
        ],
      },
      {
        stage: 'Tillering & Panicle Initiation Stage',
        timePeriod: 'From tiller initiation to panicle initiation (and early reproductive)',
        condition: 'Field has multiple tillers, plants growing stronger; panicle primordium beginning',
        activities: [
          'Apply second or split doses of nitrogen and possibly micronutrients (at panicle initiation).',
          'Continue weed monitoring & control: ensure tillers develop healthily.',
          'Pest & disease control: intensive monitoring now (brown plant-hopper, sheath blight, blast etc).',
          'Water management: ensure sustained water depth; avoid abrupt drying that may hamper tiller formation or panicle initiation.',
          'Field aeration if system allows (shallow water) but ensure plants not stressed.',
          'Mark critical water requirement around panicle initiation & upcoming flowering.',
        ],
      },
      {
        stage: 'Flowering / Grain-Filling Stage',
        timePeriod: 'From heading/flowering through grain fill until nearing maturity',
        condition: 'Panicles emerging/flowering; grains forming; water still important',
        activities: [
          'Maintain water depth appropriately (often ~3-5 cm) until grain filling complete, then gradually reduce.',
          'Apply foliar nutrients if recommended (e.g., Zn, S) to boost grain quality & weight.',
          'Pest/disease monitoring intensifies: ear-head insect pests, grain filling diseases (grain rot etc).',
          'Avoid drought stress: even short dry spells during flowering reduce yield.',
          'Keep field free from weeds (they harbour pests).',
        ],
      },
      {
        stage: 'Maturation & Harvesting',
        timePeriod: 'From grain-fill completion through ripening to harvest window',
        condition: 'Grains maturing (colour change, hardening), field water drained or reduced',
        activities: [
          'Lower or stop irrigation ~5–7 days before anticipated harvest so field dries slightly for easier harvesting.',
          'Monitor crop maturity: look for golden-brown grains, hardening, moisture ~20-24% (depending variety).',
          'Determine harvest window: when ~80-90% grains turned colour & hard; avoid over-mature (shattering, lodging risk).',
          'Harvest method: manual (sickle) or mechanical (combine) depending on scale/resources.',
          'Threshing: remove grains from panicles; aim for minimal loss. Immediately after harvest: spread on mats or tarpaulins for initial sun drying.',
        ],
      },
      {
        stage: 'Post-harvest & Storage',
        timePeriod: 'After harvest through drying, cleaning, storage',
        condition: 'Grains harvested, need safe handling & storage',
        activities: [
          'Drying: reduce grain moisture to safe storage level (often ~12-14%) via sun drying or mechanical dryers.',
          'Cleaning: remove foreign matter, broken grains, stones.',
          'Storage: store in cool, dry, ventilated space; protect from rodents, insects, mould.',
          'Transport/marketing plan: bagging, logistics to mill/market.',
          'Field residue management: incorporate straw or use for fodder; clean/re-prepare bunds/ponds for next crop.',
          'Optional: Create irrigation & nutrient chart: date vs water depth vs fertiliser vs observations (weed/pest) – integrate local weather adjustments.',
        ],
      },
    ],
  },
  {
    key: 'wheat',
    name: 'Wheat',
    stages: [
      {
        stage: 'Pre-sowing / Land Preparation',
        timePeriod: '~ Late Sep to early Oct (before sowing)',
        condition: 'Land after previous crop, allowed to dry; bunds/outlets in place; residue management needed',
        activities: [
          'Remove previous crop residues, weeds, repair bunds/field boundaries.',
          'Primary tillage: plough 2–3 passes (depth ~10-15 cm) to loosen soil.',
          'Secondary tillage/leveling: harrow/puddle (if irrigated) so seedbed is fine and uniform.',
          'Soil test: check pH, N/P/K, micronutrients; apply lime, FYM/compost, green manures as needed.',
          'Spread/incorporate organic matter (FYM/compost) before sowing.',
          'Set up irrigation/drainage: ensure irrigation facility ready, bunds watertight, field level uniform.',
        ],
      },
      {
        stage: 'Sowing / Seedling Stage',
        timePeriod: '~ Mid-Oct to late Nov (depending on region & variety)',
        condition: 'Field is prepared, ready for sowing; soil moisture adequate; seeds ready',
        activities: [
          'Select good variety seeds, treat seeds (fungicide/insecticide) if needed.',
          'Sowing: Using seed drill or appropriate method; seed rate as per variety; adjust for late sowing if applicable.',
          'Ensure good seed-soil contact, even sowing depth, adequate moisture.',
          'Immediately after sowing: light irrigation if required to ensure germination.',
          'Emergence & early growth: monitor seedling health, uniform stand.',
        ],
      },
      {
        stage: 'Vegetative Growth / Tillering Stage',
        timePeriod: '~ Sowing to ~30-45 days after sowing (varies)',
        condition: 'Plants in active vegetative growth, tillers starting; water & nutrient demand increasing',
        activities: [
          'Water management: Maintain soil moisture; irrigate as needed (in Rabi season irrigation likely).',
          'Nutrient application: Basal fertilizers (e.g., P & K) applied at or soon after sowing; early Nitrogen application at tillering.',
          'Weed control: Clear weeds early so young plants have minimal competition.',
          'Pest/disease scouting: Monitor for seedling pests, root issues, leaf diseases.',
          'Check seedlings for uniformity, ensure proper spacing if transplanted or direct sown.',
        ],
      },
      {
        stage: 'Stem Elongation / Jointing & Booting Stage',
        timePeriod: '~ 30-60 days after sowing (varies by variety)',
        condition: 'Plants are taller, nodes visible, stems elongating; reproductive development beginning',
        activities: [
          'Water management: Ensure no water stress; good soil moisture to support elongation.',
          'Nitrogen split: Apply further N as plant height increases and nodes form.',
          'Micronutrients as needed (e.g., zinc, sulphur) if deficient.',
          'Pest & disease control: Monitor for rusts, blight, aphids, etc.',
          'Field management: Ensure good stand, avoid lodging risk, manage straw/residue.',
        ],
      },
      {
        stage: 'Heading / Flowering / Grain Filling Stage',
        timePeriod: '~ 60-90 days after sowing (varies)',
        condition: 'Heads visible or emerging, flowers open, grain setting in process, high nutrient & water demand',
        activities: [
          'Maintain adequate moisture/irrigation (critical); avoid drought or heat stress.',
          'Foliar nutrients if required (e.g., zinc, boron) to boost grain set & weight.',
          'Pest/disease monitoring intensifies: head blast, rust, ergot, etc.',
          'Weed control: field clean of weeds that harbour pests.',
          'Monitor uniformity of head emergence; ensure timely operations if mechanical.',
        ],
      },
      {
        stage: 'Maturation & Harvesting',
        timePeriod: '~ 90-120+ days after sowing (depending on variety)',
        condition: 'Grain has filled, plant begins to mature (yellowing, drying); moisture content falling',
        activities: [
          'Reduce irrigation/stop when appropriate to let field dry and ease harvest.',
          'Monitor maturity by grain colour/hardness, moisture content (target safe harvest level).',
          'Harvest at optimal time: when moisture is safe and before lodging/shattering risk increases.',
          'Harvest method: manual or combine depending on scale.',
          'Threshing: remove grain carefully, minimise losses.',
        ],
      },
      {
        stage: 'Post-harvest & Storage',
        timePeriod: 'After harvest through drying, cleaning & storage',
        condition: 'Grains harvested, need safe handling, drying, storage',
        activities: [
          'Drying: reduce grain moisture to safe storage level (e.g., ~12-14 %).',
          'Cleaning: remove foreign material, broken grains, stones.',
          'Storage: store in cool, dry, ventilated conditions; protect from rodents, insects, mould.',
          'Transport/marketing: bagging, logistics to mill or market.',
        ],
      },
    ],
  },
  {
    key: 'tomato',
    name: 'Tomato',
    stages: [
      {
        stage: 'Pre‑sowing / Land Preparation',
        timePeriod: '~1–2 weeks before sowing',
        condition: 'Land cleared of previous crop, leveled, soil tested',
        activities: [
          'Remove previous crop residues and weeds.',
          'Plough or till the soil 2–3 times to loosen and aerate.',
          'Level the field to ensure uniform irrigation.',
          'Conduct soil test: check pH, N/P/K, micronutrients; apply compost, FYM, or lime as needed.',
          'Prepare irrigation setup: ensure water supply and drainage are ready.',
        ],
      },
      {
        stage: 'Seed Sowing / Nursery Stage',
        timePeriod: 'Day 0–20',
        condition: 'Seeds germinating in trays/pots/nursery bed; soil moist, warm',
        activities: [
          'Select healthy seeds of high‑yielding variety.',
          'Treat seeds with fungicide/insecticide if necessary.',
          'Sow seeds in trays/pots or nursery beds at recommended density.',
          'Maintain soil moisture by gentle irrigation; avoid waterlogging.',
          'Provide shading or partial protection if light or temperature is extreme.',
          'Harden seedlings 3–5 days before transplanting by reducing water slightly.',
        ],
      },
      {
        stage: 'Transplanting / Establishment',
        timePeriod: 'Day 21–28',
        condition: 'Seedlings 4–6 true leaves, field prepared and leveled',
        activities: [
          'Transplant seedlings at recommended spacing (e.g., 50 cm between rows, 30 cm between plants).',
          'Water immediately after transplanting to settle soil around roots.',
          'Mulch around plants to retain moisture and control weeds.',
          'Apply starter solution or basal fertilizer as per soil test.',
        ],
      },
      {
        stage: 'Vegetative Growth / Early Stage',
        timePeriod: 'Day 29–45',
        condition: 'Plants actively growing, multiple leaves, initial branching',
        activities: [
          'Maintain irrigation to keep soil consistently moist.',
          'Apply first N fertilizer split if not applied at transplanting.',
          'Weed regularly to reduce competition.',
          'Install support stakes or trellises if necessary.',
          'Monitor for pests (aphids, whiteflies) and early disease symptoms.',
        ],
      },
      {
        stage: 'Flowering Initiation',
        timePeriod: 'Day 46–60',
        condition: 'Flower buds forming, plants healthy, supported',
        activities: [
          'Ensure adequate water and nutrient supply (balanced NPK).',
          'Apply micronutrients like calcium or magnesium if deficiency noticed.',
          'Support plants with staking/ties for proper growth.',
          'Scout for pests and diseases; apply control measures as needed.',
          'Prune lower leaves if necessary for better air circulation.',
        ],
      },
      {
        stage: 'Fruit Development / Growth Stage',
        timePeriod: 'Day 61–90',
        condition: 'Flowers pollinated, small fruits developing, soil moist',
        activities: [
          'Irrigate regularly; avoid water stress during fruit set.',
          'Apply potassium-rich fertilizer to support fruit growth.',
          'Mulch to conserve moisture and suppress weeds.',
          'Continue pest/disease scouting (fruit borer, blight).',
          'Remove unhealthy leaves to reduce disease risk.',
        ],
      },
      {
        stage: 'Maturation / Pre-Harvest Stage',
        timePeriod: 'Day 91–110',
        condition: 'Fruits enlarging, colour starting to develop',
        activities: [
          'Continue irrigation and nutrient application carefully to avoid excess vegetative growth.',
          'Monitor fruits for ripening stage; prevent cracking.',
          'Protect fruits from pests and diseases.',
          'Support plants and branches bearing heavy fruit load.',
        ],
      },
      {
        stage: 'Harvesting',
        timePeriod: 'Day 111–130',
        condition: 'Fruits fully colored and mature, plants healthy',
        activities: [
          'Harvest fruits at the correct maturity for market or processing.',
          'Handle carefully to reduce bruising.',
          'Harvest in intervals if all fruits do not mature simultaneously.',
        ],
      },
      {
        stage: 'Post-Harvest / Storage',
        timePeriod: 'Immediately after harvest',
        condition: 'Fruits collected, clean, and sorted',
        activities: [
          'Sort fruits based on size and quality.',
          'Dry or store under appropriate conditions (cool, ventilated).',
          'Transport or sell promptly to reduce losses.',
          'Clear the field of residues; compost or remove for next crop.',
        ],
      },
    ],
  },
  {
    key: 'potato',
    name: 'Potato',
    stages: [
      {
        stage: 'Pre‑sowing / Land Preparation',
        timePeriod: '~1–2 weeks before planting',
        condition: 'Field cleared of previous crop, leveled, soil fertile and tested',
        activities: [
          'Remove previous crop residues and weeds.',
          'Plough 2–3 times to loosen soil and improve aeration.',
          'Level the field for uniform irrigation and tuber development.',
          'Conduct soil test: check pH, N/P/K, micronutrients; apply compost, FYM, or lime as needed.',
          'Ensure irrigation and drainage system is ready.',
        ],
      },
      {
        stage: 'Seed Selection & Treatment',
        timePeriod: 'Day 0–1',
        condition: 'Seed tubers selected; healthy, disease-free',
        activities: [
          'Select certified, disease-free seed tubers of desired variety.',
          'Treat tubers with fungicide or insecticide to prevent storage or soil-borne diseases.',
          'Pre-sprouting (chitting) if required: allow tubers to develop short sprouts before planting.',
        ],
      },
      {
        stage: 'Planting / Sowing',
        timePeriod: 'Day 1–5',
        condition: 'Seed tubers or sprouted tubers planted in prepared ridges/beds',
        activities: [
          'Plant tubers at recommended spacing (e.g., 25–30 cm between tubers, 60–75 cm between rows).',
          'Plant at depth 8–10 cm (adjust depending on soil and variety).',
          'Irrigate immediately after planting to settle soil around tubers.',
        ],
      },
      {
        stage: 'Vegetative Growth / Early Stage',
        timePeriod: 'Day 6–30',
        condition: 'Sprouts emerging; young shoots; soil moist',
        activities: [
          'Maintain consistent irrigation (avoid water stress).',
          'Apply basal fertilizers or split as per soil test.',
          'Monitor emergence and early growth; remove diseased sprouts.',
          'Weed control to reduce competition.',
          'Pest and disease scouting (early blight, aphids, leaf miners).',
        ],
      },
      {
        stage: 'Tuber Initiation Stage',
        timePeriod: 'Day 31–50',
        condition: 'Plants actively growing; first tubers forming',
        activities: [
          'Ensure adequate water supply; maintain soil moisture without waterlogging.',
          'Apply side-dress nitrogen if required.',
          'Hill up soil around plants to support tuber development.',
          'Continue pest/disease monitoring (aphids, late blight).',
          'Mulching if needed to conserve moisture and regulate soil temperature.',
        ],
      },
      {
        stage: 'Tuber Bulking / Growth Stage',
        timePeriod: 'Day 51–80',
        condition: 'Plants fully developed; tubers enlarging',
        activities: [
          'Irrigate regularly and evenly to support rapid tuber growth.',
          'Apply potassium-rich fertilizer to promote tuber size and quality.',
          'Continue pest and disease management; remove diseased foliage if necessary.',
          'Hill-up soil or add mulch periodically to prevent greening of tubers.',
        ],
      },
      {
        stage: 'Maturation / Pre-Harvest Stage',
        timePeriod: 'Day 81–100',
        condition: 'Foliage starting to yellow and die back; tubers mature',
        activities: [
          'Gradually reduce irrigation to allow foliage to die back and tubers to mature.',
          'Monitor tubers for size and quality.',
          'Stop fertilizer application; avoid excess water which may cause tuber rot.',
        ],
      },
      {
        stage: 'Harvesting',
        timePeriod: 'Day 101–120',
        condition: 'Tubers mature, foliage dry',
        activities: [
          'Harvest tubers carefully to avoid mechanical damage.',
          'Use appropriate tools (forks, spades) to lift tubers from soil.',
          'Collect tubers and sort by size/quality.',
        ],
      },
      {
        stage: 'Post-Harvest / Storage',
        timePeriod: 'Immediately after harvest',
        condition: 'Tubers clean, free of disease, sorted',
        activities: [
          'Cure tubers in a ventilated, dark place for a few days to toughen skin.',
          'Store in cool, dry, ventilated conditions; avoid light to prevent greening.',
          'Protect against pests (wireworms, rodents) and diseases (late blight).',
          'Remove field residues or compost for next crop cycle.',
        ],
      },
    ],
  },
  {
    key: 'corn',
    name: 'Corn',
    stages: [
      {
        stage: 'Pre‑sowing / Land Preparation',
        timePeriod: '~1–2 weeks before sowing',
        condition: 'Field cleared of previous crop, leveled, soil tested and fertile',
        activities: [
          'Remove crop residues and weeds.',
          'Plough 2–3 times to loosen soil and improve aeration.',
          'Level field for uniform irrigation.',
          'Conduct soil test: check pH, N/P/K, micronutrients; apply FYM/compost/lime as needed.',
          'Prepare irrigation/drainage system.',
        ],
      },
      {
        stage: 'Seed Selection & Treatment',
        timePeriod: 'Day 0',
        condition: 'Healthy, high-yielding seeds selected',
        activities: [
          'Select certified, disease-free corn seeds of desired variety.',
          'Treat seeds with fungicide/insecticide if needed.',
          'Optional: pre-soak seeds for faster germination in some cases.',
        ],
      },
      {
        stage: 'Sowing / Planting',
        timePeriod: 'Day 1–3',
        condition: 'Soil prepared, moisture adequate',
        activities: [
          'Plant seeds at recommended spacing (e.g., 20–25 cm between plants, 60–75 cm between rows) depending on variety.',
          'Plant at depth ~3–5 cm (adjust for soil type).',
          'Water immediately after sowing if soil moisture is low.',
        ],
      },
      {
        stage: 'Germination / Seedling Stage',
        timePeriod: 'Day 4–20',
        condition: 'Seeds sprouting; seedlings emerging',
        activities: [
          'Maintain soil moisture for uniform emergence.',
          'Monitor seedling health; remove diseased or weak seedlings.',
          'Weed control at early stage to reduce competition.',
          'Scout for early pests (cutworms, armyworms) and apply control measures if necessary.',
        ],
      },
      {
        stage: 'Vegetative Growth / Tillering Stage',
        timePeriod: 'Day 21–40',
        condition: 'Plants actively growing, multiple leaves',
        activities: [
          'Continue irrigation as needed; avoid water stress.',
          'Apply first split of nitrogen fertilizer; apply P & K as per soil test.',
          'Weeding and soil aeration as necessary.',
          'Monitor for pests (stem borers, leaf beetles) and diseases.',
        ],
      },
      {
        stage: 'Stem Elongation / Tasseling Initiation',
        timePeriod: 'Day 41–60',
        condition: 'Plants taller; tassels emerging; soil moist',
        activities: [
          'Apply additional nitrogen and micronutrients as required.',
          'Maintain consistent irrigation to avoid water stress.',
          'Continue pest/disease monitoring (earworms, rusts, leaf blight).',
          'Ensure good plant stand; remove lodged or damaged plants.',
        ],
      },
      {
        stage: 'Flowering / Silking & Pollination',
        timePeriod: 'Day 61–75',
        condition: 'Tassels fully visible; silks emerging; high nutrient/water demand',
        activities: [
          'Ensure adequate water supply for pollination and grain set.',
          'Apply potassium-rich fertilizer to improve grain filling.',
          'Scout intensively for pests (corn borer, aphids) and diseases (blights).',
          'Remove weeds to reduce competition and disease risk.',
        ],
      },
      {
        stage: 'Grain Filling / Maturation Stage',
        timePeriod: 'Day 76–100',
        condition: 'Grains developing; moisture still important; plant approaching maturity',
        activities: [
          'Continue irrigation until kernel hardening begins.',
          'Maintain nutrition if required, reduce nitrogen to avoid excess vegetative growth.',
          'Protect from pests and diseases.',
          'Monitor grain maturity (kernel hardness, color development).',
        ],
      },
      {
        stage: 'Harvesting',
        timePeriod: 'Day 101–120',
        condition: 'Grains fully developed; moisture content reduced (~20–25%)',
        activities: [
          'Harvest when grains reach proper moisture and maturity.',
          'Use appropriate methods (manual or mechanical) to minimize grain loss.',
          'Dry harvested cobs or grains to safe storage moisture (~12–14%).',
        ],
      },
      {
        stage: 'Post-Harvest / Storage',
        timePeriod: 'Immediately after harvest',
        condition: 'Grains clean and dried',
        activities: [
          'Clean grains, remove debris, sort for quality.',
          'Store in cool, ventilated storage; protect from pests (rodents, insects) and fungal contamination.',
          'Prepare field for next cropping cycle: remove residues, compost or plough back.',
        ],
      },
    ],
  },
  {
    key: 'onion',
    name: 'Onion',
    stages: [
      {
        stage: 'Pre‑sowing / Land Preparation',
        timePeriod: '~1–2 weeks before sowing',
        condition: 'Land cleared of previous crop; leveled; soil fertile and tested',
        activities: [
          'Remove crop residues and weeds.',
          'Plough/till 2–3 times to loosen soil.',
          'Level the field for uniform irrigation.',
          'Conduct soil test; apply FYM/compost/lime if needed.',
          'Prepare irrigation/drainage system.',
        ],
      },
      {
        stage: 'Seed Sowing / Nursery Stage',
        timePeriod: 'Day 0–25',
        condition: 'Seeds germinating in trays/pots/nursery; soil moist',
        activities: [
          'Select high-quality seeds.',
          'Sow in nursery beds or trays at recommended density.',
          'Maintain moisture with light irrigation; avoid waterlogging.',
          'Harden seedlings 5–7 days before transplanting.',
        ],
      },
      {
        stage: 'Transplanting / Establishment',
        timePeriod: 'Day 26–35',
        condition: 'Seedlings 6–8 leaf stage; field prepared',
        activities: [
          'Transplant at recommended spacing (e.g., 10–15 cm between plants, 20–25 cm between rows).',
          'Irrigate immediately.',
          'Apply starter fertilizer if required.',
        ],
      },
      {
        stage: 'Vegetative Growth',
        timePeriod: 'Day 36–70',
        condition: 'Active leaf growth; bulbs forming underground',
        activities: [
          'Maintain irrigation; avoid water stress.',
          'Apply nitrogen fertilizer as split doses.',
          'Weed control.',
          'Pest/disease scouting: thrips, downy mildew.',
        ],
      },
      {
        stage: 'Bulb Formation / Maturation',
        timePeriod: 'Day 71–110',
        condition: 'Bulbs enlarging; lower leaves yellowing',
        activities: [
          'Reduce irrigation gradually to encourage bulb maturation.',
          'Monitor pests/diseases.',
          'Mulching if necessary to retain moisture.',
        ],
      },
      {
        stage: 'Harvesting',
        timePeriod: 'Day 111–130',
        condition: 'Bulbs fully mature; tops dry',
        activities: [
          'Harvest bulbs carefully to avoid damage.',
          'Cure in ventilated area to toughen skin.',
          'Store in cool, dry place.',
        ],
      },
    ],
  },
  {
    key: 'brinjal',
    name: 'Brinjal',
    stages: [
      {
        stage: 'Pre‑sowing / Land Preparation',
        timePeriod: '~1 week before sowing',
        condition: 'Field cleared; fertile; leveled',
        activities: [
          'Remove residues and weeds.',
          'Plough/till 2–3 times.',
          'Level field; check irrigation setup.',
          'Apply FYM/compost as needed.',
        ],
      },
      {
        stage: 'Seed Sowing / Nursery',
        timePeriod: 'Day 0–25',
        condition: 'Seedlings in nursery trays/pots; soil moist',
        activities: [
          'Sow high-quality seeds in nursery.',
          'Maintain moisture; avoid waterlogging.',
          'Harden seedlings 5–7 days before transplanting.',
        ],
      },
      {
        stage: 'Transplanting / Establishment',
        timePeriod: 'Day 26–35',
        condition: 'Seedlings 4–6 leaf stage; field prepared',
        activities: [
          'Transplant at spacing 50 cm × 50 cm (adjust by variety).',
          'Irrigate immediately after transplanting.',
          'Apply basal fertilizer as per soil test.',
        ],
      },
      {
        stage: 'Vegetative Growth',
        timePeriod: 'Day 36–60',
        condition: 'Plants growing actively; multiple branches',
        activities: [
          'Maintain irrigation and drainage.',
          'Apply nitrogen fertilizer as split doses.',
          'Weeding and staking if needed.',
          'Pest/disease scouting: shoot & fruit borer',
        ],
      },
      {
        stage: 'Flowering & Fruit Set',
        timePeriod: 'Day 61–90',
        condition: 'Flowers opening; small fruits forming',
        activities: [
          'Maintain irrigation for fruit set.',
          'Apply potassium-rich fertilizer to improve fruit quality.',
          'Monitor for pests/diseases; remove affected parts.',
        ],
      },
      {
        stage: 'Fruit Development / Maturation',
        timePeriod: 'Day 91–120',
        condition: 'Fruits enlarging, reaching market size',
        activities: [
          'Continue irrigation and nutrient application.',
          'Harvest mature fruits at intervals to prevent over-ripening.',
          'Remove diseased or damaged fruits.',
        ],
      },
    ],
  },
  {
    key: 'chili',
    name: 'Chili',
    stages: [
      {
        stage: 'Pre‑sowing / Land Preparation',
        timePeriod: '~1–2 weeks before sowing',
        condition: 'Land cleared, fertile, leveled',
        activities: [
          'Remove residues and weeds.',
          'Plough 2–3 times; level soil.',
          'Apply compost/FYM; prepare irrigation.',
        ],
      },
      {
        stage: 'Seed Sowing / Nursery',
        timePeriod: 'Day 0–30',
        condition: 'Seeds germinating in nursery beds/trays; soil moist',
        activities: [
          'Sow seeds in nursery trays/pots.',
          'Maintain soil moisture; avoid waterlogging.',
          'Harden seedlings before transplanting.',
        ],
      },
      {
        stage: 'Transplanting / Establishment',
        timePeriod: 'Day 31–40',
        condition: 'Seedlings 6–8 leaf stage; field prepared',
        activities: [
          'Transplant at recommended spacing (e.g., 45–60 cm between rows, 30–45 cm between plants).',
          'Irrigate immediately.',
          'Apply basal fertilizers as per soil test.',
        ],
      },
      {
        stage: 'Vegetative Growth',
        timePeriod: 'Day 41–70',
        condition: 'Plants actively growing; multiple branches',
        activities: [
          'Maintain irrigation; avoid water stress.',
          'Side-dress nitrogen as needed.',
          'Weed control.',
          'Pest/disease monitoring: aphids, mites, leaf spot.',
        ],
      },
      {
        stage: 'Flowering & Fruit Set',
        timePeriod: 'Day 71–100',
        condition: 'Flowers visible; fruits forming',
        activities: [
          'Ensure irrigation for pollination and fruit set.',
          'Apply potassium & phosphorus for fruit quality.',
          'Support plants if necessary.',
          'Continue pest/disease control.',
        ],
      },
      {
        stage: 'Fruit Development / Maturation',
        timePeriod: 'Day 101–130',
        condition: 'Fruits enlarging, ripening',
        activities: [
          'Harvest mature fruits at intervals.',
          'Protect fruits from pests and sunscald.',
          'Continue monitoring for diseases.',
        ],
      },
    ],
  },
  {
    key: 'carrot',
    name: 'Carrot',
    stages: [
      {
        stage: 'Pre‑sowing / Land Preparation',
        timePeriod: '~1 week before sowing',
        condition: 'Field cleared, loose, fertile, leveled',
        activities: [
          'Remove residues and weeds.',
          'Deep plough to loosen soil (avoid stones).',
          'Level field for uniform irrigation.',
          'Apply FYM/compost and other soil amendments.',
        ],
      },
      {
        stage: 'Seed Sowing',
        timePeriod: 'Day 0–7',
        condition: 'Seeds sown in fine, loose seedbed',
        activities: [
          'Sow seeds directly in rows at recommended spacing (2–5 cm between plants, 30 cm between rows).',
          'Cover lightly with soil.',
          'Maintain soil moisture for germination.',
        ],
      },
      {
        stage: 'Germination / Seedling Stage',
        timePeriod: 'Day 8–25',
        condition: 'Seedlings emerging; soil moist',
        activities: [
          'Maintain soil moisture with light irrigation.',
          'Thin seedlings to proper spacing.',
          'Weed control.',
          'Monitor for soil-borne pests (root-knot nematodes).',
        ],
      },
      {
        stage: 'Vegetative / Root Development',
        timePeriod: 'Day 26–50',
        condition: 'Plants actively growing; roots elongating',
        activities: [
          'Continue regular irrigation; avoid water stress.',
          'Side-dress nitrogen as needed.',
          'Weeding and earthing-up if necessary.',
          'Monitor for pests/diseases (aphids, leaf blight).',
        ],
      },
      {
        stage: 'Root Maturation / Pre-Harvest',
        timePeriod: 'Day 51–70',
        condition: 'Roots approaching marketable size; leaves healthy',
        activities: [
          'Reduce irrigation gradually before harvest.',
          'Remove diseased leaves; continue pest monitoring.',
          'Mulch if needed to prevent cracking.',
        ],
      },
      {
        stage: 'Harvesting',
        timePeriod: 'Day 71–90',
        condition: 'Roots fully developed; leaves yellowing/slightly dry',
        activities: [
          'Harvest carefully to avoid root damage.',
          'Wash, grade, and dry if needed.',
          'Store in cool, ventilated place.',
        ],
      },
    ],
  },
];
