import {supabase} from './supabase';
import type {Session, User, AuthChangeEvent} from '@supabase/supabase-js';

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

export type {Session, User};
