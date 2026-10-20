"""Mappings from dataset labels to AgriSmart's canonical slugs.

The backend's crop catalog, disease knowledge base and pest knowledge base are keyed by
these slugs (`backend/seeds/*.json`). A model may only predict labels that exist there, so
training fails loudly on any dataset label that is not mapped here.
"""

# Kaggle "Crop Recommendation Dataset" (atharvaingle) → crop slug
CROP_RECOMMENDATION_LABELS = {
    "rice": "rice", "maize": "maize", "chickpea": "chickpea", "kidneybeans": "kidney_beans",
    "pigeonpeas": "pigeon_pea", "mothbeans": "moth_bean", "mungbean": "green_gram",
    "blackgram": "black_gram", "lentil": "lentil", "pomegranate": "pomegranate",
    "banana": "banana", "mango": "mango", "grapes": "grapes", "watermelon": "watermelon",
    "muskmelon": "muskmelon", "apple": "apple", "orange": "orange", "papaya": "papaya",
    "coconut": "coconut", "cotton": "cotton", "jute": "jute", "coffee": "coffee",
}

# Kaggle "Crop Yield in Indian States" (akshatgupta7) → crop slug.
# Excluded on purpose: cotton and jute/mesta (production in bales, not tonnes), coconut
# (production in nuts) and aggregate classes such as "Other Kharif pulses".
YIELD_CROPS = {
    "Rice": "rice", "Wheat": "wheat", "Maize": "maize", "Bajra": "bajra", "Jowar": "jowar",
    "Ragi": "ragi", "Gram": "chickpea", "Arhar/Tur": "pigeon_pea",
    "Moong(Green Gram)": "green_gram", "Urad": "black_gram", "Masoor": "lentil", "Moth": "moth_bean",
    "Groundnut": "groundnut", "Soyabean": "soybean", "Rapeseed &Mustard": "mustard",
    "Sugarcane": "sugarcane", "Onion": "onion", "Potato": "potato", "Banana": "banana",
}

# Planted area is comparable across all crops (unlike production units), so the regional
# prior used by crop recommendation also covers cotton, jute and coconut.
AREA_CROPS = {**YIELD_CROPS, "Cotton(lint)": "cotton", "Jute": "jute", "Coconut": "coconut"}

YIELD_SEASONS = {
    "kharif": "kharif", "autumn": "kharif", "rabi": "rabi", "winter": "rabi",
    "summer": "zaid", "whole year": "whole_year",
}

STATE_ALIASES = {"Orissa": "Odisha", "Pondicherry": "Puducherry", "Uttaranchal": "Uttarakhand"}


def normalize_state(name: str) -> str:
    """Must match the backend's location normalisation (whitespace-collapsed str.title())."""
    name = " ".join(str(name).split())
    return STATE_ALIASES.get(name, name).title()


def _plantvillage(crop: str, disease: str, slug: str) -> tuple[str, str]:
    return f"{crop}___{disease}", slug


# PlantVillage class folders (as in "New Plant Diseases Dataset", vipoooool) → slug
PLANTVILLAGE_LABELS = dict([
    _plantvillage("Apple", "Apple_scab", "apple.apple_scab"),
    _plantvillage("Apple", "Black_rot", "apple.black_rot"),
    _plantvillage("Apple", "Cedar_apple_rust", "apple.cedar_apple_rust"),
    _plantvillage("Apple", "healthy", "apple.healthy"),
    _plantvillage("Blueberry", "healthy", "blueberry.healthy"),
    _plantvillage("Cherry_(including_sour)", "Powdery_mildew", "cherry.powdery_mildew"),
    _plantvillage("Cherry_(including_sour)", "healthy", "cherry.healthy"),
    _plantvillage("Corn_(maize)", "Cercospora_leaf_spot Gray_leaf_spot", "maize.gray_leaf_spot"),
    _plantvillage("Corn_(maize)", "Common_rust_", "maize.common_rust"),
    _plantvillage("Corn_(maize)", "Northern_Leaf_Blight", "maize.northern_leaf_blight"),
    _plantvillage("Corn_(maize)", "healthy", "maize.healthy"),
    _plantvillage("Grape", "Black_rot", "grapes.black_rot"),
    _plantvillage("Grape", "Esca_(Black_Measles)", "grapes.esca_black_measles"),
    _plantvillage("Grape", "Leaf_blight_(Isariopsis_Leaf_Spot)", "grapes.leaf_blight"),
    _plantvillage("Grape", "healthy", "grapes.healthy"),
    _plantvillage("Orange", "Haunglongbing_(Citrus_greening)", "orange.citrus_greening"),
    _plantvillage("Peach", "Bacterial_spot", "peach.bacterial_spot"),
    _plantvillage("Peach", "healthy", "peach.healthy"),
    _plantvillage("Pepper,_bell", "Bacterial_spot", "bell_pepper.bacterial_spot"),
    _plantvillage("Pepper,_bell", "healthy", "bell_pepper.healthy"),
    _plantvillage("Potato", "Early_blight", "potato.early_blight"),
    _plantvillage("Potato", "Late_blight", "potato.late_blight"),
    _plantvillage("Potato", "healthy", "potato.healthy"),
    _plantvillage("Raspberry", "healthy", "raspberry.healthy"),
    _plantvillage("Soybean", "healthy", "soybean.healthy"),
    _plantvillage("Squash", "Powdery_mildew", "squash.powdery_mildew"),
    _plantvillage("Strawberry", "Leaf_scorch", "strawberry.leaf_scorch"),
    _plantvillage("Strawberry", "healthy", "strawberry.healthy"),
    _plantvillage("Tomato", "Bacterial_spot", "tomato.bacterial_spot"),
    _plantvillage("Tomato", "Early_blight", "tomato.early_blight"),
    _plantvillage("Tomato", "Late_blight", "tomato.late_blight"),
    _plantvillage("Tomato", "Leaf_Mold", "tomato.leaf_mold"),
    _plantvillage("Tomato", "Septoria_leaf_spot", "tomato.septoria_leaf_spot"),
    _plantvillage("Tomato", "Spider_mites Two-spotted_spider_mite", "tomato.spider_mites"),
    _plantvillage("Tomato", "Target_Spot", "tomato.target_spot"),
    _plantvillage("Tomato", "Tomato_Yellow_Leaf_Curl_Virus", "tomato.yellow_leaf_curl_virus"),
    _plantvillage("Tomato", "Tomato_mosaic_virus", "tomato.mosaic_virus"),
    _plantvillage("Tomato", "healthy", "tomato.healthy"),
])

# Kaggle "Agricultural Pests Image Dataset" (vencerlanz09) folders → slug
PEST_LABELS = {
    "ants": "ants", "bees": "bees", "beetle": "beetle", "catterpillar": "caterpillar",
    "earthworms": "earthworms", "earwig": "earwig", "grasshopper": "grasshopper", "moth": "moth",
    "slug": "slug", "snail": "snail", "wasp": "wasp", "weevil": "weevil",
}
