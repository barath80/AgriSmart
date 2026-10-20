import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function HelpSupportScreen() {
  const navigation = useNavigation();

  const supportOptions = [
    {
      icon: 'mail',
      title: 'Email Support',
      description: 'Send us an email at support@agrismart.com',
      action: 'Email us',
    },
    {
      icon: 'call',
      title: 'Phone Support',
      description: 'Call us at +91-1800-XXX-XXXX',
      action: 'Call us',
    },
    {
      icon: 'chatbubbles',
      title: 'Live Chat',
      description: 'Chat with our support team',
      action: 'Start chat',
    },
    {
      icon: 'document-text',
      title: 'FAQs',
      description: 'Frequently asked questions',
      action: 'View FAQs',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#000000', '#071840'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#E6F7FF" />
          </TouchableOpacity>
          <Text style={styles.title}>Help & Support</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get Help</Text>
          <Text style={styles.sectionDescription}>
            We're here to help you with any questions or issues you may have.
            Choose a support option below to get in touch with our team.
          </Text>
        </View>

        {supportOptions.map((option, index) => (
          <View key={index} style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <Ionicons name={option.icon as any} size={32} color="#22c55e" />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>{option.action}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common Issues</Text>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I reset my password?</Text>
            <Text style={styles.faqAnswer}>
              Go to the login screen and click "Forgot Password". You'll receive
              a reset link via email or SMS.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I update my profile?</Text>
            <Text style={styles.faqAnswer}>
              Navigate to the Profile tab and tap on your profile information
              to edit your details.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I report a bug?</Text>
            <Text style={styles.faqAnswer}>
              Contact us via email at support@agrismart.com with details about
              the issue you're experiencing.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operating Hours</Text>
          <Text style={styles.hoursText}>
            Monday - Friday: 9:00 AM - 6:00 PM{'\n'}
            Saturday: 10:00 AM - 4:00 PM{'\n'}
            Sunday: Closed
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E6F7FF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E6F7FF',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#9aa9b8',
    lineHeight: 20,
  },
  optionCard: {
    backgroundColor: '#071837',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  optionText: {
    flex: 1,
    marginLeft: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E6F7FF',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#9aa9b8',
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  faqItem: {
    backgroundColor: '#071837',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#11324a',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E6F7FF',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#9aa9b8',
    lineHeight: 20,
  },
  hoursText: {
    fontSize: 14,
    color: '#9aa9b8',
    lineHeight: 24,
  },
});

