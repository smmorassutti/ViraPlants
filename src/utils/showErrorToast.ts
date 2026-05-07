import {create} from 'zustand';

type ToastState = {
  message: string | null;
  shownAt: number;
};

type ToastActions = {
  show: (message: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastState & ToastActions>(set => ({
  message: null,
  shownAt: 0,
  show: message => set({message, shownAt: Date.now()}),
  clear: () => set({message: null}),
}));

export const showErrorToast = (message: string): void => {
  useToastStore.getState().show(message);
};
