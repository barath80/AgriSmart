import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  SafeAreaView
} from 'react-native';
import { BACKEND_URL } from '../utils/backendUrl';

// Health Test Button Component
const HealthTestButton = () => {
  const [testing, setTesting] = useState(false);
  
  return (
    <TouchableOpacity
      style={[styles.healthButton, testing && styles.healthButtonDisabled]}
      onPress={async () => {
        if (testing) return;
        setTesting(true);
        try {
          console.log('Testing health endpoint:', `${BACKEND_URL}/health`);
          
          // Add timeout to fetch
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const r = await fetch(`${BACKEND_URL}/health`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          clearTimeout(timeoutId);
          
          const t = await r.text();
          console.log('Health check response:', r.status, t);
          
          if (r.ok) {
            Alert.alert('Health Check ✅', `Status: ${r.status}\nResponse: ${t}\n\nBackend is reachable!`);
          } else {
            Alert.alert('Health Check ⚠️', `Status: ${r.status}\nResponse: ${t}`);
          }
        } catch (e: any) {
          console.error('Health check error:', e);
          let errorMsg = e.message || String(e);
          
          if (e.name === 'AbortError') {
            errorMsg = 'Request timed out. Backend server may not be running or unreachable.';
          } else if (e.message?.includes('Network request failed') || e.message?.includes('Failed to fetch')) {
            errorMsg = `Cannot connect to backend at ${BACKEND_URL}\n\nMake sure the backend server is running.`;
          }
          
          Alert.alert(
            'Health Check ❌', 
            `Error: ${errorMsg}\n\nBackend URL: ${BACKEND_URL}\n\nPlease check:\n1. Backend server is running\n2. Correct IP address\n3. Network connectivity`
          );
        } finally {
          setTesting(false);
        }
      }}
      disabled={testing}
    >
      <Text style={styles.healthButtonText}>
        {testing ? 'Testing...' : 'Test /health'}
      </Text>
    </TouchableOpacity>
  );
};

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const ChatAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Log backend URL on mount for debugging
  useEffect(() => {
    console.log('ChatAssistant mounted');
    console.log('BACKEND_URL:', BACKEND_URL);
    console.log('Platform:', Platform.OS);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendPrompt = async (prompt: string) => {
    if (!prompt.trim()) return;
    
    const userMessage = prompt.trim();
    setMessages(m => [...m, { role: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    console.log('Sending prompt to:', `${BACKEND_URL}/generate`);
    console.log('Prompt:', userMessage);

    try {
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const res = await fetch(`${BACKEND_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('Response status:', res.status);
      console.log('Response ok:', res.ok);

      if (!res.ok) {
        const txt = await res.text();
        console.error('Server error response:', txt);
        let errorText = txt;
        try {
          const errorJson = JSON.parse(txt);
          errorText = errorJson.error || errorJson.message || txt;
        } catch {
          // Not JSON, use text as is
        }
        errorText = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
        setMessages(m => [...m, { 
          role: 'assistant', 
          text: `❌ Server Error (${res.status}): ${errorText}\n\nPlease check if the backend server is running.` 
        }]);
        setLoading(false);
        return;
      }

      const json = await res.json();
      console.log('Response JSON:', json);
      
      const reply = json.reply || json.message || 'No reply received';
      console.log('Extracted reply:', reply);
      
      setMessages(m => [...m, { role: 'assistant', text: reply }]);
    } catch (err: any) {
      console.error('Fetch error:', err);
      let errorMessage = err.message || String(err) || 'Unknown network error';
      
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out. The backend server may not be responding. Please check if the server is running.';
      } else if (err.message?.includes('Network request failed') || err.message?.includes('Failed to fetch')) {
        errorMessage = `Cannot connect to backend server at ${BACKEND_URL}.\n\nPlease ensure:\n1. Backend server is running\n2. Correct IP address and port\n3. Network connectivity`;
      }
      
      setMessages(m => [...m, { 
        role: 'assistant', 
        text: `❌ Network Error: ${errorMessage}\n\nBackend URL: ${BACKEND_URL}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (input.trim() && !loading) {
      sendPrompt(input.trim());
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Assistant</Text>
        <Text style={styles.debugText}>Backend: {BACKEND_URL}</Text>
        <HealthTestButton />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => `${item.role}-${index}`}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.role === 'user' ? styles.userMessage : styles.assistantMessage
            ]}>
              <Text style={[
                styles.messageText,
                item.role === 'user' ? styles.userText : styles.assistantText
              ]}>
                {item.text}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Start a conversation with AI Assistant</Text>
              <Text style={styles.emptySubtext}>Ask questions about farming, crops, or agriculture</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor="#9aa9b8"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!loading}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, loading && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={loading || !input.trim()}
          >
            <Text style={styles.sendButtonText}>
              {loading ? 'Sending...' : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>
        {loading && (
          <View style={styles.loadingIndicator}>
            <Text style={styles.loadingText}>Waiting for response...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#ec4899',
    padding: 20,
    paddingTop: 24,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 8,
  },
  healthButton: {
    backgroundColor: '#22c55e',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  healthButtonDisabled: {
    opacity: 0.6,
  },
  healthButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    backgroundColor: '#ec4899',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#1e293b',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: '#ffffff',
  },
  assistantText: {
    color: '#e6f7ff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#071837',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#e6f7ff',
    padding: 12,
    borderRadius: 20,
    maxHeight: 100,
    marginRight: 8,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#ec4899',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingIndicator: {
    padding: 12,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default ChatAssistant;
