import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { secureStorage } from "./supabase";
// On devices, even text-only drafts are encrypted using the OS key store.
export const draftStorage =
  Platform.OS === "web" ? AsyncStorage : secureStorage;
