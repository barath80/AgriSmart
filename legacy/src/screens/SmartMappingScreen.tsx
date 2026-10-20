import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config/api';
import Constants from 'expo-constants';

type Marker = { state: string; category: string; name: string; lat: number; lon: number };

export default function SmartMappingScreen() {
  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgriculturalData = async () => {
      setLoading(true);
      try {
        // Get API key from environment
        const apiKey = Constants.expoConfig?.extra?.apiKey || 
                       (typeof process.env.EXPO_PUBLIC_BACKEND_URL === 'string' ? process.env.EXPO_PUBLIC_BACKEND_URL : '');
        
        // Fetch real agricultural locations from backend API
        const response = await fetch(`${API_BASE_URL}/locations?apiKey=${apiKey}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: 10000,
        });

        if (response.ok) {
          const data = await response.json();
          const fetchedMarkers: Marker[] = (data.locations || []).map((loc: any) => ({
            state: loc.state || 'Unknown',
            category: loc.category || 'Agricultural Site',
            name: loc.name || 'Location',
            lat: parseFloat(loc.latitude || loc.lat || 0),
            lon: parseFloat(loc.longitude || loc.lon || 0),
          })).filter((m: Marker) => !isNaN(m.lat) && !isNaN(m.lon) && m.lat !== 0 && m.lon !== 0);

          if (fetchedMarkers.length > 0) {
            setMarkers(fetchedMarkers);
            setError(null);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error('API fetch error:', e);
      }

      // Fallback: Load from CSV file or use sample data
      tryLoadCSVFallback();
    };

    const tryLoadCSVFallback = async () => {
      try {
        // Try to load CSV with fallback to sample markers
        const candidates = [
          ((FileSystem as any).documentDirectory || '') + 'India_Agriculture_Locations.csv',
          '/India_Agriculture_Locations.csv',
          'India_Agriculture_Locations.csv',
        ].filter(Boolean);

        let csvText: string | null = null;
        for (const url of candidates) {
          try {
            const docDir = (FileSystem as any).documentDirectory;
            if (docDir && url.startsWith(docDir)) {
              const info = await (FileSystem as any).getInfoAsync(url);
              if (info.exists) {
                csvText = await (FileSystem as any).readAsStringAsync(url);
                break;
              }
            }
            const res = await fetch(url);
            if (res.ok) {
              csvText = await res.text();
              break;
            }
          } catch (e) {
            // continue
          }
        }

        if (csvText) {
          const parsedMarkers = parseCsvToMarkers(csvText);
          if (parsedMarkers.length > 0) {
            setMarkers(parsedMarkers);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error('CSV load error:', e);
      }

      // Fallback: Use sample agricultural sites across India
      const sampleMarkers: Marker[] = [
        { state: 'Punjab', category: 'Agricultural Research Institute', name: 'PAU Research Farm - Ludhiana', lat: 30.9010, lon: 75.8573 },
        { state: 'Haryana', category: 'KVK (Krishi Vigyan Kendra)', name: 'KVK Hisar', lat: 29.1533, lon: 75.7197 },
        { state: 'Uttar Pradesh', category: 'Agricultural University', name: 'CSAUAT - Kanpur', lat: 25.4358, lon: 75.8529 },
        { state: 'Tamil Nadu', category: 'Agricultural Research Station', name: 'TNAU - Coimbatore', lat: 11.0426, lon: 76.9123 },
        { state: 'Karnataka', category: 'Agricultural College', name: 'UAS - Bangalore', lat: 13.1939, lon: 77.5941 },
        { state: 'Maharashtra', category: 'Soil Testing Lab', name: 'MPKV - Rahuri', lat: 19.7515, lon: 75.6372 },
        { state: 'Rajasthan', category: 'Farm Machinery Centre', name: 'SKRAU - Bikaner', lat: 28.0229, lon: 71.4547 },
        { state: 'Andhra Pradesh', category: 'Agricultural Research Institute', name: 'ANGRAU - Hyderabad', lat: 17.3850, lon: 78.4867 },
        { state: 'Gujarat', category: 'Agricultural University', name: 'AAU - Anand', lat: 22.5355, lon: 72.9263 },
        { state: 'West Bengal', category: 'KVK (Krishi Vigyan Kendra)', name: 'KVK Nadia', lat: 23.4361, lon: 88.4765 },
      ];

      setMarkers(sampleMarkers);
      setError('API unavailable. Showing sample agricultural locations.');
      setLoading(false);
    };

    fetchAgriculturalData();
  }, []);

  const html = buildHtmlForMarkers(markers);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>SmartMapping</Text>
        <Text style={styles.subtitle}>Interactive India map — tap markers for details</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={styles.loadingText}>Loading map...</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      ) : (
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          style={styles.webview}
          scalesPageToFit
          javaScriptEnabled
          domStorageEnabled
        />
      )}
    </SafeAreaView>
  );
}

function parseCsvToMarkers(csvText: string): Marker[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const markers: Marker[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Robust split: lat and lon are the last two comma-separated values
    const parts = line.split(',');
    if (parts.length < 5) continue;
    const lon = parts[parts.length - 1];
    const lat = parts[parts.length - 2];
    const state = parts[0];
    const category = parts[1];
    const nameParts = parts.slice(2, parts.length - 2);
    const name = nameParts.join(',').trim();

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) continue;

    markers.push({ state: state.trim(), category: category.trim(), name, lat: latNum, lon: lonNum });
  }

  return markers;
}

function buildHtmlForMarkers(markers: Marker[]) {
  const markersJson = JSON.stringify(markers.slice(0, 20)); // Limit to 20 markers max for speed
  
  // Ultra-lightweight map without external dependencies
  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>India Map</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 100%; height: 100%; overflow: hidden; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      #map { width: 100%; height: 100%; position: relative; background: linear-gradient(135deg, #e3f2fd 0%, #f1f8e9 100%); }
      .tile-container { position: absolute; width: 100%; height: 100%; overflow: hidden; }
      .marker { position: absolute; width: 28px; height: 32px; cursor: pointer; }
      .marker-pin { width: 100%; height: 100%; background: radial-gradient(circle at 30% 30%, #4FC3F7, #0288D1); border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold; }
      .marker-pin::after { content: ''; position: absolute; width: 8px; height: 8px; background: white; border-radius: 50%; }
      .popup { position: fixed; bottom: 20px; left: 20px; right: 20px; background: white; padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; display: none; }
      .popup.show { display: block; animation: slideUp 0.3s ease-out; }
      .popup-name { font-weight: 700; color: #1a1a1a; margin-bottom: 4px; font-size: 14px; }
      .popup-category { color: #0288D1; font-weight: 500; margin-bottom: 2px; font-size: 12px; }
      .popup-state { opacity: 0.6; color: #666; font-size: 11px; }
      .close-btn { position: absolute; top: 8px; right: 8px; background: none; border: none; cursor: pointer; font-size: 20px; color: #999; }
      @keyframes slideUp { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      .stats { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 8px 12px; border-radius: 4px; font-size: 11px; z-index: 100; }
    </style>
  </head>
  <body>
    <div id="map">
      <div class="tile-container" id="tiles"></div>
    </div>
    <div class="popup" id="popup">
      <button class="close-btn" onclick="document.getElementById('popup').classList.remove('show');">✕</button>
      <div class="popup-name" id="popupName"></div>
      <div class="popup-category" id="popupCategory"></div>
      <div class="popup-state" id="popupState"></div>
    </div>
    <div class="stats" id="stats">0 locations</div>
    <script>
      try {
        const markers = ${markersJson};
        const map = document.getElementById('map');
        const tilesDiv = document.getElementById('tiles');
        
        // Simple mercator projection with safety checks
        function project(lat, lon, zoom) {
          lat = Math.max(-85, Math.min(85, lat)); // Clamp latitude to valid range
          const x = (lon + 180) * (256 / 360) * Math.pow(2, zoom);
          const latRad = lat * Math.PI / 180;
          const sinLat = Math.sin(latRad);
          const y = (128 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / Math.PI * 128) * Math.pow(2, zoom);
          return { x: isFinite(x) ? x : 0, y: isFinite(y) ? y : 0 };
        }
        
        // Create simple static background (no tile loading)
        tilesDiv.style.background = 'linear-gradient(135deg, #e3f2fd 0%, #f1f8e9 100%)';
        tilesDiv.innerHTML = '<svg style="position:absolute;width:100%;height:100%;" viewBox="0 0 960 600"><path d="M300,150 L400,100 L450,200 L350,250 Z" fill="#90caf9" stroke="#1565c0" stroke-width="2"/><text x="350" y="180" font-size="10" fill="#1565c0" text-anchor="middle">India</text></svg>';
        
        const zoom = 4;
        const centerLat = 22, centerLon = 78;
        const centerProj = project(centerLat, centerLon, zoom);
        const mapWidth = map.offsetWidth || window.innerWidth;
        const mapHeight = map.offsetHeight || window.innerHeight;
        const offsetX = mapWidth / 2 - centerProj.x;
        const offsetY = mapHeight / 2 - centerProj.y;
        
        // Render markers
        if (Array.isArray(markers)) {
          markers.forEach((m, idx) => {
            if (!m || isNaN(m.lat) || isNaN(m.lon)) return;
            const proj = project(m.lat, m.lon, zoom);
            const marker = document.createElement('div');
            marker.className = 'marker';
            marker.style.left = (proj.x + offsetX) + 'px';
            marker.style.top = (proj.y + offsetY) + 'px';
            marker.style.transform = 'translate(-50%, -100%)';
            marker.innerHTML = '<div class="marker-pin"></div>';
            marker.onclick = () => showPopup(m);
            tilesDiv.appendChild(marker);
          });
        }
        
        function showPopup(marker) {
          document.getElementById('popupName').textContent = marker.name || '';
          document.getElementById('popupCategory').textContent = marker.category || '';
          document.getElementById('popupState').textContent = marker.state || '';
          document.getElementById('popup').classList.add('show');
        }
        
        document.getElementById('stats').textContent = (markers.length || 0) + ' location' + ((markers.length || 0) !== 1 ? 's' : '');
      } catch(err) {
        console.error('Map error:', err);
        document.getElementById('tiles').innerHTML = '<div style="padding:20px;color:red;">Error loading map: ' + (err.message || 'Unknown error') + '</div>';
      }
    </script>
  </body>
  </html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#071837' },
  title: { fontSize: 20, fontWeight: '700', color: '#e6f7ff' },
  subtitle: { color: '#9aa9b8', marginTop: 4, fontSize: 14 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#9aa9b8', marginTop: 8, fontSize: 14 },
  errorText: { color: '#fca5a5', marginTop: 8, paddingHorizontal: 12, textAlign: 'center', fontSize: 12 },
  webview: { flex: 1, backgroundColor: '#ffffff' },
});

