import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  TouchableOpacity,
  Animated,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import VoiceRecorder from '../components/VoiceRecorder';

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

// Language mapping: convert i18n language codes to BCP 47 tags for Web Speech API
const getSpeechLanguage = (langCode: string): string => {
  const langMap: { [key: string]: string } = {
    'en': 'en-US',
    'ta': 'ta-IN',
    'hi': 'hi-IN',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-BR',
    'ru': 'ru-RU',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ar': 'ar-SA',
    'nl': 'nl-NL',
    'pl': 'pl-PL',
    'tr': 'tr-TR',
    'sv': 'sv-SE',
    'da': 'da-DK',
    'no': 'no-NO',
    'fi': 'fi-FI',
    'cs': 'cs-CZ',
    'el': 'el-GR',
    'he': 'he-IL',
    'th': 'th-TH',
    'vi': 'vi-VN',
    'id': 'id-ID',
    'ms': 'ms-MY',
  };
  
  // If already a BCP 47 tag, return as is
  if (langCode.includes('-')) {
    return langCode;
  }
  
  // Map common language codes, fallback to langCode if not found
  return langMap[langCode] || langCode;
};

export default function VoiceAssistantScreen() {
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [conversation, setConversation] = useState<Array<{ type: 'user' | 'assistant'; text: string }>>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { i18n, t } = useTranslation();
  const navigation = useNavigation();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isWeb = Platform.OS === 'web';

  // Handle voice command using Web Speech API TTS
  const handleVoiceCommand = useCallback(async (command: string) => {
    // Add user message to conversation
    setConversation(prev => [...prev, { type: 'user', text: command }]);
    
    // Process voice command and get AI response
    // This would call your backend /voice/process endpoint
    
    // For now, generate a simple response
    const response = `I heard you say: "${command}". How can I help you with your farming needs?`;
    
    // Add assistant response to conversation
    setConversation(prev => [...prev, { type: 'assistant', text: response }]);
    
    // Use Web Speech API TTS with multi-language support
    if (isWeb && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(response);
        utterance.lang = getSpeechLanguage(i18n.language || 'en');
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Error in text-to-speech:', error);
      }
    }
  }, [isWeb, i18n.language]);

  // Initialize Web Speech API
  useEffect(() => {
    if (isWeb && typeof window !== 'undefined') {
      // Check if Web Speech API is available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition() as SpeechRecognition;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = getSpeechLanguage(i18n.language || 'en');

          recognition.onstart = () => {
            setIsListening(true);
          };

          recognition.onend = () => {
            setIsListening(false);
          };

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
              } else {
                interimTranscript += transcript;
              }
            }

            const displayText = finalTranscript + interimTranscript;
            setSpokenText(displayText.trim());

            // Only process command when we have a final result
            if (finalTranscript.trim()) {
              handleVoiceCommand(finalTranscript.trim());
            }
          };

          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
          };

          recognitionRef.current = recognition;
        } catch (error) {
          console.error('Error initializing speech recognition:', error);
        }
      } else {
        console.warn('Web Speech API not supported in this browser');
      }
    }

    return () => {
      if (recognitionRef.current && isWeb) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (error) {
          console.error('Error cleaning up recognition:', error);
        }
      }
    };
  }, [isWeb, i18n.language, handleVoiceCommand]);

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isListening, scaleAnim]);

  const startListening = async () => {
    if (isWeb && typeof window !== 'undefined' && recognitionRef.current) {
      try {
        recognitionRef.current.lang = getSpeechLanguage(i18n.language || 'en');
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting voice recognition:', error);
        setIsListening(false);
      }
    }
  };

  const stopListening = async () => {
    if (isWeb && typeof window !== 'undefined' && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping voice recognition:', error);
        setIsListening(false);
      }
    }
  };

  const clearConversation = () => {
    setConversation([]);
    setSpokenText('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#E6F7FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Assistant</Text>
        <View style={styles.clearButton} />
      </View>

      {/* Conversation Area */}
      <ScrollView
        style={styles.conversationContainer}
        contentContainerStyle={styles.conversationContent}
        showsVerticalScrollIndicator={false}
      >
        {conversation.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mic" size={64} color="#94A3B8" />
            <Text style={styles.emptyText}>Start speaking to interact with your voice assistant</Text>
            <Text style={styles.emptySubtext}>Click the microphone button below to begin</Text>
          </View>
        ) : (
          conversation.map((msg, idx) => (
            <View
              key={idx}
              style={[
                styles.messageBubble,
                msg.type === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Ionicons
                name={msg.type === 'user' ? 'person' : 'chatbubble-ellipses'}
                size={20}
                color={msg.type === 'user' ? '#fff' : '#000'}
                style={styles.messageIcon}
              />
              <Text
                style={[
                  styles.messageText,
                  msg.type === 'user' ? styles.userText : styles.assistantText,
                ]}
              >
                {msg.text}
              </Text>
            </View>
          ))
        )}
        
        {/* Current spoken text (interim results) */}
        {spokenText && !conversation.some(msg => msg.text === spokenText && msg.type === 'user') && (
          <View style={[styles.messageBubble, styles.interimBubble]}>
            <Text style={styles.interimText}>{spokenText}</Text>
          </View>
        )}
      </ScrollView>

      {/* Voice Input Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, isListening && styles.statusDotActive]} />
          <Text style={styles.statusText}>
            {isListening ? 'Listening...' : 'Tap to speak'}
          </Text>
        </View>
        
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.micButton,
              isListening && styles.micButtonActive,
            ]}
            onPress={isListening ? stopListening : startListening}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isListening ? 'mic' : 'mic-outline'}
              size={40}
              color={isListening ? '#ffffff' : '#22c55e'}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Mobile Voice Recorder (expo-av) - Only show on iOS/Android */}
      {!isWeb && (
        <View style={styles.voiceRecorderContainer}>
          <Text style={styles.voiceRecorderTitle}>Voice Chat (Record & Send)</Text>
          <VoiceRecorder />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#90EE90',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6F7FF',
  },
  clearButton: {
    padding: 8,
  },
  conversationContainer: {
    flex: 1,
    padding: 16,
  },
  conversationContent: {
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E6F7FF',
    marginTop: 24,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  messageBubble: {
    flexDirection: 'row',
    marginVertical: 8,
    padding: 12,
    borderRadius: 16,
    maxWidth: '85%',
    alignItems: 'flex-start',
  },
  userBubble: {
    backgroundColor: '#22c55e',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#1f2937',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  interimBubble: {
    backgroundColor: '#374151',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    opacity: 0.7,
  },
  messageIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  messageText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
  },
  userText: {
    color: '#ffffff',
  },
  assistantText: {
    color: '#E6F7FF',
  },
  interimText: {
    color: '#E6F7FF',
    fontSize: 15,
    fontStyle: 'italic',
  },
  controlsContainer: {
    padding: 20,
    backgroundColor: '#071837',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  micButtonActive: {
    backgroundColor: '#22c55e',
  },
  voiceRecorderContainer: {
    padding: 16,
    backgroundColor: '#071837',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  voiceRecorderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E6F7FF',
    marginBottom: 12,
    textAlign: 'center',
  },
});




