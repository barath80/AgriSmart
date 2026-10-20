import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Platform, Alert, KeyboardAvoidingView, Keyboard, KeyboardEvent } from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CommunityScreen() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Array<{ id: string; author: string; text: string; time: string; image?: string; price?: string }>>([]);
  const [input, setInput] = useState('');
  const inputRef = useRef<TextInput | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const listRef = useRef<FlatList<any> | null>(null);
  const [wsUrl, setWsUrl] = useState('ws://192.168.1.2:8080');
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const sellTitleRef = useRef<TextInput | null>(null);
  const [sellTitle, setSellTitle] = useState('');
  const [sellImageUrl, setSellImageUrl] = useState('');
  const [sellPrice, setSellPrice] = useState('');

  const pickImage = () => {
    // Try react-native-image-picker first (bare RN), then expo-image-picker (Expo), else show alert
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RNImagePicker = require('react-native-image-picker');
      const pickerModule = RNImagePicker && (RNImagePicker.default || RNImagePicker);
      const handleResp = (resp: any) => {
        if (!resp) return;
        // modern callback shape
        if (resp.didCancel || resp.cancelled) return;
        if (resp.errorCode || resp.error) {
          Alert.alert('Image pick error', resp.errorMessage || resp.errorCode || resp.error);
          return;
        }
        // support multiple possible uri locations
        const uri = resp?.assets?.[0]?.uri || resp?.uri || resp?.path || resp?.fileUri || (resp?.data ? `data:image/jpeg;base64,${resp.data}` : undefined);
        if (uri) setSellImageUrl(uri);
      };
      // launchImageLibrary may be on the default export or module itself and may return a promise or accept a callback
      const launch = pickerModule.launchImageLibrary || pickerModule.launchImageLibraryAsync || null;
      if (launch) {
        const maybePromise = launch.call(pickerModule, { mediaType: 'photo', quality: 0.8 }, handleResp);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then((resp: any) => handleResp(resp)).catch((e: any) => {
            console.warn('RNImagePicker promise error', e);
          });
        }
      }
      return;
    } catch (err) {
      // fallthrough to try expo-image-picker
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ExpoImagePicker = require('expo-image-picker');
      const expo = ExpoImagePicker && (ExpoImagePicker.default || ExpoImagePicker);
      (async () => {
        try {
          const permission = await expo.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permission required', 'Please allow photo library access to pick images.');
            return;
          }
          const result = await expo.launchImageLibraryAsync({ mediaTypes: expo.MediaTypeOptions.Images, quality: 0.8 });
          const cancelled = result.cancelled || result.canceled;
          if (cancelled) return;
          // expo may return { cancelled, uri } or { canceled, assets: [{ uri }] }
          const uri = (result as any)?.uri || (result as any)?.assets?.[0]?.uri;
          if (uri) setSellImageUrl(uri);
        } catch (e) {
          Alert.alert('Image pick error', String(e));
        }
      })();
      return;
    } catch (err) {
      // No picker available
    }

    Alert.alert('Image picker not available', 'To pick images from the gallery install and configure either react-native-image-picker (bare RN) or expo-image-picker (Expo).');
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg = { id: Date.now().toString(), author: t('community.you'), text: input.trim(), time: t('community.now') };
    setMessages((m) => [...m, newMsg]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
    if (wsRef.current && connected) {
      try { wsRef.current.send(JSON.stringify({ author: t('community.peer'), text: newMsg.text, time: newMsg.time, id: newMsg.id })); } catch (e) { console.warn('WS send failed', e); }
    }
  };

  const connectWs = () => {
    if (wsRef.current) { try { wsRef.current.close(); } catch(e){} wsRef.current = null; }
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); console.log('WS connected'); };
      ws.onclose = () => { setConnected(false); console.log('WS closed'); };
      ws.onerror = (e) => { console.warn('WS error', e); };
      ws.onmessage = (evt) => {
        try {
          const data = typeof evt.data === 'string' ? JSON.parse(evt.data) : null;
          const incoming = data || { text: String(evt.data), author: t('community.peer'), time: t('community.now'), id: Date.now().toString() };
          setMessages((m) => [...m, { id: incoming.id || Date.now().toString(), author: incoming.author || t('community.peer'), text: incoming.text, time: incoming.time || t('community.now') }]);
          setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
        } catch (err) { console.warn('WS msg parse failed', err); }
      };
    } catch (err) { Alert.alert('WebSocket error', String(err)); }
  };

  const disconnectWs = () => { try { wsRef.current?.close(); } catch(e){} wsRef.current = null; setConnected(false); };

  // Handle keyboard show/hide
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 100);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#14b8a6' }}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('community.title')}</Text>
          <Text style={styles.subtitle}>{t('community.subtitle')}</Text>
        </View>
      </SafeAreaView>
      <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1, borderColor: '#11324a', borderRadius: 8, padding: 8, color: '#e6f7ff', marginRight: 8 }}
          value={wsUrl}
          onChangeText={setWsUrl}
          placeholder="ws://host:port"
          placeholderTextColor="#9aa9b8"
        />
        <TouchableOpacity onPress={connected ? disconnectWs : connectWs} style={[styles.sendBtn, { paddingHorizontal: 12 }]}> 
          <Text style={styles.sendText}>{connected ? t('community.disconnect') : t('community.connect')}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: true })}
        contentContainerStyle={styles.messagesList}
        style={{ flex: 1 }}
        renderItem={({ item }) => {
          const outgoing = item.author === t('community.you');
          return (
            <View style={[styles.messageRow, outgoing ? styles.rowRight : styles.rowLeft]}>
              {!outgoing && (
                <View style={styles.msgAvatar}>
                  <Text style={styles.avatarText}>{item.author[0]}</Text>
                </View>
              )}

              <View style={[styles.msgBody, outgoing ? styles.msgBodyOutgoing : styles.msgBodyIncoming]}>
                <Text style={styles.msgAuthor}>{item.author} <Text style={styles.msgTime}>{item.time}</Text></Text>
                <Text style={styles.msgText}>{item.text}</Text>
                {item.price ? <Text style={[styles.msgText, { marginTop: 6, fontWeight: '700' }]}>Max: ₹{item.price}</Text> : null}
                {item.image && <Image source={{ uri: item.image }} style={styles.postedImage} resizeMode="cover" />}
              </View>

              {outgoing && (
                <View style={[styles.msgAvatar, styles.avatarRight]}>
                  <Text style={styles.avatarText}>{item.author[0]}</Text>
                </View>
              )}
            </View>
          );
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.plusBtn}
            onPress={() => setMenuVisible((v) => !v)}
            accessibilityLabel="Open actions"
          >
            <Text style={styles.plusText}>+</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            {menuVisible && (
              <View style={styles.actionMenu}>
                <TouchableOpacity style={styles.actionItem} onPress={() => { setMenuVisible(false); setSellModalVisible(true); setTimeout(() => sellTitleRef.current?.focus(), 60); }}>
                  <Text style={styles.actionOptionText}>Sell items</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => { setInput('Expert help needed: '); setMenuVisible(false); inputRef.current?.focus(); }}>
                  <Text style={styles.actionOptionText}>Expert help</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => { setInput('Tip: '); setMenuVisible(false); inputRef.current?.focus(); }}>
                  <Text style={styles.actionOptionText}>Give tips</Text>
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              ref={inputRef}
              style={styles.inputField}
              placeholder={`Type a message...`}
              placeholderTextColor="#9aa9b8"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={sendMessage}
              onFocus={() => setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 150)}
              returnKeyType="send"
            />
          </View>

          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.sendText}>{t('community.send')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {sellModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Sell an item</Text>
            <TextInput
              ref={sellTitleRef}
              style={[styles.modalTextInput, styles.modalInput]}
              placeholder="Item title"
              placeholderTextColor="#9aa9b8"
              value={sellTitle}
              onChangeText={setSellTitle}
            />
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity style={[styles.sendBtn, { marginBottom: 8 }]} onPress={pickImage}>
                <Text style={styles.sendText}>Upload Image</Text>
              </TouchableOpacity>
              <Text style={{ color: '#9aa9b8', fontSize: 13 }}>Tap to pick an image from gallery</Text>
            </View>
            {sellImageUrl ? <Image source={{ uri: sellImageUrl }} style={styles.postedImage} /> : null}
            <TextInput
              style={[styles.modalTextInput, styles.modalInput]}
              placeholder="Max price (₹)"
              placeholderTextColor="#9aa9b8"
              keyboardType="numeric"
              value={sellPrice}
              onChangeText={setSellPrice}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.sendBtn, { marginRight: 8 }]} onPress={() => {
                // Validate that an image has been picked and price provided
                if (!sellImageUrl) { Alert.alert('Missing image', 'Please pick an image from your gallery before posting.'); return; }
                if (!sellPrice || !sellPrice.trim()) { Alert.alert('Missing price', 'Please enter a maximum price for the item.'); return; }
                const title = sellTitle || 'Item for sale';
                const price = `Price: ₹${sellPrice}`;
                const text = `For sale: ${title}\n${price}`;
                const newMsg = { id: Date.now().toString(), author: 'You', text, time: 'Now', image: sellImageUrl, price: sellPrice };
                setMessages((m) => [...m, newMsg]);
                if (wsRef.current && connected) {
                  try { wsRef.current.send(JSON.stringify(newMsg)); } catch (e) { console.warn('WS send failed', e); }
                }
                setSellModalVisible(false);
                setSellTitle(''); setSellImageUrl(''); setSellPrice('');
                setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
              }}>
                <Text style={styles.sendText}>Post</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#64748b' }]} onPress={() => { setSellModalVisible(false); setSellTitle(''); setSellImageUrl(''); setSellPrice(''); }}>
                <Text style={styles.sendText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: '#14b8a6',
    padding: 20,
    paddingTop: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e6f7ff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#071837',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: '#e6f7ff',
  },
  postCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0b6b3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  postInfo: {
    flex: 1,
  },
  author: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e6f7ff',
  },
  time: {
    fontSize: 12,
    color: 'white',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e6f7ff',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
    color: '#9aa9b8',
    lineHeight: 20,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    color: 'white',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 80,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0b6b3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarRight: {
    marginLeft: 12,
    marginRight: 0,
  },
  msgBody: {
    flex: 1,
    backgroundColor: '#071837',
    padding: 12,
    borderRadius: 8,
  },
  msgBodyOutgoing: {
    backgroundColor: '#0ea5a4',
    alignSelf: 'flex-end',
    borderTopRightRadius: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  msgBodyIncoming: {
    backgroundColor: '#071837',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  msgAuthor: {
    fontSize: 13,
    color: '#e6f7ff',
    fontWeight: '600',
    marginBottom: 4,
  },
  msgTime: {
    fontSize: 11,
    color: 'white',
    fontWeight: '400',
  },
  msgText: {
    fontSize: 14,
    color: '#9aa9b8',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 0,
    marginBottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#11324a',
    backgroundColor: '#000000',
    width: '100%',
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0ea5a4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  plusText: { color: '#021427', fontWeight: '800', fontSize: 22 },
  actionMenu: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    backgroundColor: '#071837',
    borderWidth: 1,
    borderColor: '#11324a',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    zIndex: 50,
    elevation: 6,
  },
  actionItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionOptionText: { color: '#e6f7ff', fontWeight: '600' },
  inputField: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#11324a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#071837',
    color: '#e6f7ff',
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#11324a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#071837',
    color: '#e6f7ff',
    width: '100%',
  },
  sendBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendText: {
    color: '#021427',
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  modalBox: {
  width: '90%',
  maxWidth: 480,
  backgroundColor: '#071837',
  padding: 16,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#11324a',
  },
  modalTitle: { color: '#e6f7ff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalInput: { marginBottom: 8 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  postedImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#0b1220',
  },
});
