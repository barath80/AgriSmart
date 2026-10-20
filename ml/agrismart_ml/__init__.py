"""Training code for AgriSmart's models.

Notebooks in `ml/notebooks/` call these functions; the functions do the real work so
the same code is tested, reviewed and reused. Every model is exported as an immutable,
versioned artifact directory (`artifacts/<name>/<name>_vN/`) in the format the backend's
`app.ml.runtime` loads: framework-native weights + `metadata.json`.
"""

__version__ = "1.0.0"
