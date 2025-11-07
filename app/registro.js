import React, { useState, useCallback } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config/api';

const API_BASE_URL = API_CONFIG.API_BASE_URL;

// Constantes de diseño
const COLORS = {
  primary: '#2e7d32',
  primaryLight: '#4caf50',
  background: '#f8f9fa',
  white: '#ffffff',
  text: '#333333',
  textLight: '#666666',
  border: '#e0e0e0',
  error: '#d32f2f',
  farmer: '#4caf50',
  scientist: '#2196f3',
};

const ROLE_OPTIONS = [
  { value: 'farmer', label: '👨‍🌾 Agricultor', color: COLORS.farmer },
  { value: 'scientist', label: '🔬 Científico', color: COLORS.scientist },
];

export default function RegistroScreen() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'farmer',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);

  // Handlers memoizados
  const handleInputChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleRoleSelect = useCallback((role) => {
    setForm(prev => ({ ...prev, role }));
  }, []);

  const toggleShowPasswords = useCallback(() => {
    setShowPasswords(prev => !prev);
  }, []);

  const validateForm = useCallback(() => {
    const { name, email, password, confirmPassword } = form;

    if (!name.trim()) return 'Por favor ingresa tu nombre de usuario';
    if (name.trim().length < 2) return 'El nombre de usuario debe tener al menos 2 caracteres';
    if (!email.trim()) return 'Por favor ingresa tu email';
    if (!email.includes('@')) return 'Por favor ingresa un email válido';
    if (!password) return 'Por favor ingresa una contraseña';
    if (password.length < 5) return 'La contraseña debe tener al menos 5 caracteres';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
    
    return null;
  }, [form]);

  const handleRegistro = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Error', validationError);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      };

      const response = await fetch(`${API_BASE_URL}/auth/registro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.usuario) {
        await AsyncStorage.setItem('user', JSON.stringify(data.usuario));
        
        Alert.alert(
          '¡Registro Exitoso!', 
          'Tu cuenta ha sido creada correctamente',
          [{ text: 'Continuar', onPress: () => router.replace('/') }]
        );
      } else {
        const errorMessage = data.error || 'Error en el registro';
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.log('❌ Error en registro:', error);
      Alert.alert(
        'Error de Conexión', 
        'No se pudo conectar al servidor. Verifica tu conexión.'
      );
    } finally {
      setLoading(false);
    }
  }, [form, validateForm]);

  const navigateToLogin = useCallback(() => {
    router.back();
  }, []);

  const isFormValid = form.name && form.email && form.password && form.confirmPassword;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.subtitle}>Únete a nuestra comunidad agrícola</Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          {/* Información básica */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Personal</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nombre de usuario *</Text>
              <TextInput
                style={styles.input}
                placeholder="Elige un nombre de usuario"
                value={form.name}
                onChangeText={(value) => handleInputChange('name', value)}
                autoCapitalize="words"
                autoCorrect={false}
                placeholderTextColor={COLORS.textLight}
                editable={!loading}
                maxLength={30}
              />
              <Text style={styles.helperText}>
                Mínimo 2 caracteres
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Correo electrónico *</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                value={form.email}
                onChangeText={(value) => handleInputChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={COLORS.textLight}
                editable={!loading}
              />
            </View>
          </View>

          {/* Tipo de usuario */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de Usuario *</Text>
            <View style={styles.roleContainer}>
              {ROLE_OPTIONS.map((option) => (
                <RoleButton
                  key={option.value}
                  option={option}
                  isSelected={form.role === option.value}
                  onSelect={handleRoleSelect}
                  disabled={loading}
                />
              ))}
            </View>
          </View>

          {/* Contraseñas */}
          <View style={styles.section}>
            <View style={styles.passwordSectionHeader}>
              <Text style={styles.sectionTitle}>Seguridad</Text>
              <TouchableOpacity 
                style={styles.eyeButtonGlobal}
                onPress={toggleShowPasswords}
                disabled={loading}
              >
                <Text style={styles.eyeIconGlobal}>
                  {showPasswords ? '👁️ Mostrando' : '👁️‍🗨️ Ocultas'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Contraseña *</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 5 caracteres"
                value={form.password}
                onChangeText={(value) => handleInputChange('password', value)}
                secureTextEntry={!showPasswords}
                placeholderTextColor={COLORS.textLight}
                editable={!loading}
              />
              <Text style={styles.helperText}>
                La contraseña debe tener al menos 5 caracteres
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirmar contraseña *</Text>
              <TextInput
                style={styles.input}
                placeholder="Repite tu contraseña"
                value={form.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                secureTextEntry={!showPasswords}
                placeholderTextColor={COLORS.textLight}
                editable={!loading}
              />
            </View>
          </View>

          {/* Botón de registro */}
          <TouchableOpacity 
            style={[
              styles.button, 
              (!isFormValid || loading) && styles.buttonDisabled
            ]} 
            onPress={handleRegistro}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.buttonText}>Crear Cuenta</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
          <TouchableOpacity onPress={navigateToLogin}>
            <Text style={styles.linkText}> Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Componente de botón de rol reutilizable
const RoleButton = React.memo(({ option, isSelected, onSelect, disabled }) => (
  <TouchableOpacity
    style={[
      styles.roleButton,
      { borderColor: option.color },
      isSelected && { backgroundColor: option.color },
      disabled && styles.roleButtonDisabled
    ]}
    onPress={() => onSelect(option.value)}
    disabled={disabled}
  >
    <Text style={[
      styles.roleText,
      isSelected && styles.roleTextSelected
    ]}>
      {option.label}
    </Text>
  </TouchableOpacity>
));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
    paddingLeft: 4,
  },
  passwordSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eyeButtonGlobal: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  eyeIconGlobal: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    fontSize: 16,
    color: COLORS.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleButtonDisabled: {
    opacity: 0.6,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  roleTextSelected: {
    color: COLORS.white,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: COLORS.textLight,
    fontSize: 14,
  },
  linkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});