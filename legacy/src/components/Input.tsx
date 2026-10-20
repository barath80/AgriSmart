import React, { forwardRef } from 'react';
import { TextInput, Text, View, StyleSheet, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const Input = forwardRef<TextInput, InputProps>(({ label, error, ...props }, ref) => {
  const { style, ...rest } = props as any;
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[styles.input, error ? styles.inputError : undefined, style]}
        placeholderTextColor="#9aa9b8"
        selectionColor="#ffffff"
        {...rest}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

export default Input;

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  color: '#e6f7ff',
    marginBottom: 8,
  },
  input: {
  borderWidth: 1,
  borderColor: '#11324a',
  borderRadius: 8,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 16,
  backgroundColor: '#071837',
  color: '#e6f7ff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
});

