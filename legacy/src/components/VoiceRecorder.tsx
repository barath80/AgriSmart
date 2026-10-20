import React, { useState } from "react";
import { View, Button, Text, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";
import { BACKEND_URL } from "../utils/backendUrl";

export default function VoiceRecorder() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [status, setStatus] = useState<"idle"|"recording"|"uploading"|"done"|"error">("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission required", "Please grant microphone permission");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setStatus("recording");
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  async function stopAndUpload() {
    if (!recording) return;
    setStatus("uploading");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error("No recording URI available");
      }

      // Build multipart form (Expo handles file URIs)
      const form = new FormData();
      form.append("audio", {
        uri,
        name: "input.m4a", // Expo often records m4a on Android
        type: "audio/m4a",
      } as any);

      const res = await fetch(`${BACKEND_URL}/voice`, {
        method: "POST",
        body: form,
        // no Content-Type header — let fetch set the multipart boundary
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setTranscript(json.transcript || "");
      setReply(json.reply || "");
      // speak reply with device TTS
      if (json.reply) Speech.speak(json.reply);
      setStatus("done");
    } catch (err: any) {
      console.error("Upload error", err);
      Alert.alert("Upload error", err.message || "unknown");
      setStatus("error");
    }
  }

  return (
    <View style={styles.container}>
      <Button
        title={recording ? "Stop & Send" : "Start Recording"}
        onPress={recording ? stopAndUpload : startRecording}
      />
      <Text style={styles.statusText}>Status: {status}</Text>
      {status === "uploading" && <ActivityIndicator />}
      <Text style={styles.label}>Transcript:</Text>
      <Text style={styles.text}>{transcript}</Text>
      <Text style={styles.label}>Assistant reply:</Text>
      <Text style={styles.text}>{reply}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  statusText: {
    marginTop: 8,
    color: "#E6F7FF",
  },
  label: {
    marginTop: 12,
    fontWeight: "600",
    color: "#E6F7FF",
  },
  text: {
    color: "#E6F7FF",
    marginTop: 4,
  },
});

