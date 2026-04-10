import {supabase} from './supabase';
import type {Session, User, AuthChangeEvent} from '@supabase/supabase-js';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import {GOOGLE_IOS_CLIENT_ID} from '../config/env';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
};

export const googleSignIn = async () => {
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    return null;
  }
  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('No ID token returned from Google Sign-In.');
  }
  const {data, error} = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data;
};

export const appleSignIn = async () => {
  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });
  if (!response.identityToken) {
    throw new Error('No identity token returned from Apple Sign-In.');
  }
  const {data, error} = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: response.identityToken,
  });
  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string) => {
  const {data, error} = await supabase.auth.signUp({email, password});
  if (error) throw error;
  return data;
};

export const signIn = async (email: string, password: string) => {
  const {data, error} = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const {error} = await supabase.auth.signOut();
  if (error) throw error;
};

export const getSession = async () => {
  const {data, error} = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) => {
  const {data} = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
};

export const getProfile = async (userId: string) => {
  const {data, error} = await supabase
    .from('profiles')
    .select('display_name, created_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return {
    displayName: data.display_name as string | null,
    createdAt: data.created_at as string,
  };
};

export type {Session, User};
