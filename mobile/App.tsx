import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import * as ScreenOrientation from "expo-screen-orientation";
import { ResizeMode, Video, VideoFullscreenUpdate } from "expo-av";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent, ViewStyle } from "react-native";

import {
  API_BASE_URL,
  AppSettings,
  Application,
  Festival,
  FestivalComment,
  Profile,
  ProfileCar,
  createFestivalComment,
  deleteCar,
  deleteFestivalComment,
  fetchAppSettings,
  fetchApplications,
  fetchFestivals,
  fetchProfile,
  loginProfile,
  mediaUrl,
  registerProfile as registerProfileApi,
  updateCar,
  updateProfile,
} from "./src/api";

type Tab = "home" | "profile";
type ProfileSection = "menu" | "data" | "cars" | "applications";
type PhoneCountryCode = "UZ" | "KZ" | "KG" | "TJ" | "TM" | "RU" | "CN" | "MN" | "PK" | "AF";

type ProfileForm = {
  full_name: string;
  phone_digits: string;
  password: string;
  password_confirm: string;
};

type CarForm = {
  make: string;
  model: string;
  year: string;
  engine: string;
  condition: string;
  tuning_details: string;
};

const initialProfileForm: ProfileForm = {
  full_name: "",
  phone_digits: "",
  password: "",
  password_confirm: "",
};

const initialCarForm: CarForm = {
  make: "",
  model: "",
  year: "",
  engine: "",
  condition: "",
  tuning_details: "",
};

const minCarYear = 1900;
const maxCarYear = 2026;

const statusLabels: Record<Application["status"], string> = {
  new: "Новая",
  reviewing: "На рассмотрении",
  approved: "Одобрена",
  rejected: "Отказ",
};

const applicationStatusStyles: Record<Application["status"], ViewStyle> = {
  new: { backgroundColor: "#F1F1F3" },
  reviewing: { backgroundColor: "#FFE8C7" },
  approved: { backgroundColor: "#DDF7E8" },
  rejected: { backgroundColor: "#FFE0E0" },
};

const STORED_PROFILE_ID_KEY = "major_fest_profile_id";

const phoneCountries: Array<{
  code: PhoneCountryCode;
  name: string;
  flag: string;
  dialCode: string;
  digits: number;
  example: string;
}> = [
  { code: "UZ", name: "Узбекистан", flag: "🇺🇿", dialCode: "+998", digits: 9, example: "901234567" },
  { code: "KZ", name: "Казахстан", flag: "🇰🇿", dialCode: "+7", digits: 10, example: "7012345678" },
  { code: "KG", name: "Киргизия", flag: "🇰🇬", dialCode: "+996", digits: 9, example: "701234567" },
  { code: "TJ", name: "Таджикистан", flag: "🇹🇯", dialCode: "+992", digits: 9, example: "901234567" },
  { code: "TM", name: "Туркменистан", flag: "🇹🇲", dialCode: "+993", digits: 8, example: "61234567" },
  { code: "RU", name: "Россия", flag: "🇷🇺", dialCode: "+7", digits: 10, example: "9012345678" },
  { code: "CN", name: "Китай", flag: "🇨🇳", dialCode: "+86", digits: 11, example: "13123456789" },
  { code: "MN", name: "Монголия", flag: "🇲🇳", dialCode: "+976", digits: 8, example: "99112233" },
  { code: "PK", name: "Пакистан", flag: "🇵🇰", dialCode: "+92", digits: 10, example: "3012345678" },
  { code: "AF", name: "Афганистан", flag: "🇦🇫", dialCode: "+93", digits: 9, example: "701234567" },
];

const defaultPhoneCountry = phoneCountries[0];

function detectPhoneCountry(phone: string) {
  return phoneCountries
    .slice()
    .sort((first, second) => second.dialCode.length - first.dialCode.length)
    .find((country) => phone.startsWith(country.dialCode)) ?? defaultPhoneCountry;
}

function phoneDigitsWithoutCountry(phone: string, country: typeof defaultPhoneCountry) {
  return phone.startsWith(country.dialCode)
    ? phone.slice(country.dialCode.length).replace(/\D/g, "").slice(0, country.digits)
    : phone.replace(/\D/g, "").slice(0, country.digits);
}

function countdownParts(festival: Festival, now: Date) {
  if (isFestivalEnded(festival, now)) {
    return { state: "ended" as const, days: "00", hours: "00", minutes: "00", seconds: "00" };
  }

  const dateValue = festival.start_date;
  const target = new Date(dateValue);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    return { state: "started" as const, days: "00", hours: "00", minutes: "00", seconds: "00" };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return {
    state: "upcoming" as const,
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function formatMoney(value: string | null) {
  if (!value) {
    return null;
  }
  return `${Number(value).toLocaleString("ru-RU")} сум`;
}

function isFestivalEnded(festival: Festival, now: Date) {
  if (festival.status === "closed" || festival.status === "finished") {
    return true;
  }
  return Boolean(festival.end_date && new Date(festival.end_date).getTime() <= now.getTime());
}

async function getApiError(response: Response) {
  const text = await response.text();
  if (!text) {
    return `HTTP ${response.status}`;
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") {
      return parsed;
    }
    if (Array.isArray(parsed)) {
      return parsed.join("\n");
    }
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed)
        .flat()
        .map((value) => String(value))
        .join("\n");
    }
    return JSON.stringify(parsed);
  } catch {
    return text;
  }
}

async function appendImageToFormData(body: FormData, fieldName: string, photo: ImagePicker.ImagePickerAsset) {
  const fileName = photo.fileName ?? `${fieldName}.jpg`;
  const mimeType = photo.mimeType ?? "image/jpeg";

  if (Platform.OS === "web") {
    const webFile = (photo as ImagePicker.ImagePickerAsset & { file?: File }).file;
    if (webFile) {
      body.append(fieldName, webFile, webFile.name || fileName);
      return;
    }
    const imageResponse = await fetch(photo.uri);
    if (!imageResponse.ok) {
      throw new Error("Не удалось подготовить фото для загрузки.");
    }
    const blob = await imageResponse.blob();
    body.append(fieldName, blob, fileName);
    return;
  }

  body.append(fieldName, {
    uri: photo.uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
}

function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Отмена", style: "cancel", onPress: () => resolve(false) },
      { text: "Продолжить", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

async function saveStoredProfileId(profileId: number) {
  if (Platform.OS === "web") {
    window.localStorage.setItem(STORED_PROFILE_ID_KEY, String(profileId));
    return;
  }
  await SecureStore.setItemAsync(STORED_PROFILE_ID_KEY, String(profileId));
}

async function loadStoredProfileId() {
  const value = Platform.OS === "web"
    ? window.localStorage.getItem(STORED_PROFILE_ID_KEY)
    : await SecureStore.getItemAsync(STORED_PROFILE_ID_KEY);
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function clearStoredProfileId() {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(STORED_PROFILE_ID_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(STORED_PROFILE_ID_KEY);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [now, setNow] = useState(() => new Date());
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [phoneCountry, setPhoneCountry] = useState(defaultPhoneCountry);
  const [phoneCountryMenuOpen, setPhoneCountryMenuOpen] = useState(false);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [selectedFestivalId, setSelectedFestivalId] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(initialProfileForm);
  const [carForm, setCarForm] = useState<CarForm>(initialCarForm);
  const [carPhotos, setCarPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [profilePhoto, setProfilePhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [removeProfilePhoto, setRemoveProfilePhoto] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({ full_name: "", telegram: "", city: "" });
  const [selectedCarIds, setSelectedCarIds] = useState<number[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCar, setSavingCar] = useState(false);
  const [carSaveStatus, setCarSaveStatus] = useState("");
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [carsMenuOpen, setCarsMenuOpen] = useState(false);
  const [addingCar, setAddingCar] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfileEdit, setSavingProfileEdit] = useState(false);
  const [profileSection, setProfileSection] = useState<ProfileSection>("menu");
  const [editingCarId, setEditingCarId] = useState<number | null>(null);

  const selectedFestival = useMemo(
    () => festivals.find((festival) => festival.id === selectedFestivalId),
    [festivals, selectedFestivalId],
  );

  useEffect(() => {
    loadFestivals();
    loadAppSettings();
    restoreSession();
  }, []);

  async function loadAppSettings() {
    try {
      setAppSettings(await fetchAppSettings());
    } catch {
      setAppSettings(null);
    }
  }

  async function restoreSession() {
    try {
      const storedProfileId = await loadStoredProfileId();
      if (storedProfileId) {
        await refreshProfile(storedProfileId);
      }
    } catch {
      await clearStoredProfileId();
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadFestivals() {
    try {
      const items = await fetchFestivals();
      setFestivals(items);
    } catch {
      setFestivals([]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfile(profileId: number) {
    const freshProfile = await fetchProfile(profileId);
    const freshApplications = await fetchApplications(profileId);
    setProfile(freshProfile);
    setProfileEditForm({
      full_name: freshProfile.full_name,
      telegram: freshProfile.telegram,
      city: freshProfile.city,
    });
    setProfilePhoto(null);
    setRemoveProfilePhoto(false);
    setApplications(freshApplications);
  }

  function updateProfileField(name: keyof ProfileForm, value: string) {
    const normalizedValue = name === "phone_digits" ? value.replace(/\D/g, "").slice(0, phoneCountry.digits) : value;
    setProfileForm((current) => ({ ...current, [name]: normalizedValue }));
  }

  function selectPhoneCountry(country: typeof defaultPhoneCountry) {
    setPhoneCountry(country);
    setPhoneCountryMenuOpen(false);
    setProfileForm((current) => ({
      ...current,
      phone_digits: current.phone_digits.replace(/\D/g, "").slice(0, country.digits),
    }));
  }

  function updateCarField(name: keyof CarForm, value: string) {
    const normalizedValue = name === "year" ? value.replace(/\D/g, "").slice(0, 4) : value;
    setCarForm((current) => ({ ...current, [name]: normalizedValue }));
  }

  function carApplications(carId: number) {
    return applications.filter((application) =>
      application.cars_detail.some((car) => car.id === carId),
    );
  }

  function startAddCar() {
    setEditingCarId(null);
    setCarForm(initialCarForm);
    setCarPhotos([]);
    setCarSaveStatus("");
    setAddingCar(true);
  }

  async function startEditCar(car: ProfileCar) {
    const relatedApplications = carApplications(car.id);
    if (relatedApplications.length > 0) {
      const confirmed = await confirmAction(
        "Машина уже в заявке",
        `Этой машиной уже оставлена заявка на фестиваль. Если изменить машину, связанные заявки будут удалены, и нужно будет отправить заявку заново. Продолжить?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setEditingCarId(car.id);
    setCarForm({
      make: car.make,
      model: car.model,
      year: String(car.year),
      engine: car.engine,
      condition: car.condition,
      tuning_details: car.tuning_details,
    });
    setCarPhotos([]);
    setCarSaveStatus("");
    setAddingCar(true);
  }

  function closeCarForm() {
    setAddingCar(false);
    setEditingCarId(null);
    setCarForm(initialCarForm);
    setCarPhotos([]);
    setCarSaveStatus("");
  }

  async function submitAuth() {
    const phone = `${phoneCountry.dialCode}${profileForm.phone_digits}`;

    if (profileForm.phone_digits.length !== phoneCountry.digits) {
      Alert.alert(
        "Телефон указан неправильно",
        `Для ${phoneCountry.name} после ${phoneCountry.dialCode} нужно ввести ${phoneCountry.digits} цифр.`,
      );
      return;
    }

    if (!profileForm.password) {
      Alert.alert("Введите пароль", "Пароль нужен для входа в профиль.");
      return;
    }

    if (authMode === "register" && !profileForm.full_name) {
      Alert.alert("Введите имя", "Имя нужно для регистрации.");
      return;
    }

    if (authMode === "register" && profileForm.password !== profileForm.password_confirm) {
      Alert.alert("Пароли не совпадают", "Повтори пароль точно так же.");
      return;
    }

    try {
      setSavingProfile(true);
      const payload = {
        full_name: profileForm.full_name,
        phone,
        password: profileForm.password,
        password_confirm: profileForm.password_confirm,
      };
      const savedProfile = authMode === "register"
        ? await registerProfileApi(payload)
        : await loginProfile(payload);
      await saveStoredProfileId(savedProfile.id);
      setProfile(savedProfile);
      setProfileEditForm({
        full_name: savedProfile.full_name,
        telegram: savedProfile.telegram,
        city: savedProfile.city,
      });
      const savedCountry = detectPhoneCountry(savedProfile.phone);
      setPhoneCountry(savedCountry);
      setProfileForm({
        full_name: savedProfile.full_name,
        phone_digits: phoneDigitsWithoutCountry(savedProfile.phone, savedCountry),
        password: "",
        password_confirm: "",
      });
      await refreshProfile(savedProfile.id);
      Alert.alert(authMode === "register" ? "Регистрация готова" : "Вход выполнен", "Профиль загружен.");
    } catch (error) {
      Alert.alert("Не получилось", error instanceof Error ? error.message : "Проверь, что Django API запущен.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function pickCarPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      const oversized = result.assets.find((photo) => photo.fileSize && photo.fileSize > 50 * 1024 * 1024);
      if (oversized) {
        Alert.alert("Файл слишком большой", "Размер одного фото не должен превышать 50 МБ.");
        return;
      }
      setCarPhotos(result.assets.slice(0, 5));
      setCarSaveStatus("");
    }
  }

  async function pickProfilePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled) {
      setProfilePhoto(result.assets[0]);
      setRemoveProfilePhoto(false);
    }
  }

  function markProfilePhotoForRemoval() {
    setProfilePhoto(null);
    setRemoveProfilePhoto(true);
  }

  async function addCar() {
    setCarSaveStatus("Проверяем данные автомобиля...");
    if (!profile) {
      setCarSaveStatus("Сначала нужно войти в профиль.");
      Alert.alert("Сначала регистрация", "Создай профиль, потом добавь автомобиль.");
      return;
    }

    if (!carForm.make || !carForm.model || !carForm.year || !carForm.engine) {
      setCarSaveStatus("Заполни марку, модель, год и мотор.");
      Alert.alert("Автомобиль не заполнен", "Нужны марка, модель, год и мотор.");
      return;
    }

    if (!Number.isInteger(Number(carForm.year))) {
      setCarSaveStatus("Год должен быть числом.");
      Alert.alert("Год указан неправильно", "В поле год нужно ввести только число, например 2018.");
      return;
    }

    const carYear = Number(carForm.year);
    if (carYear < minCarYear || carYear > maxCarYear) {
      setCarSaveStatus(`Год должен быть от ${minCarYear} до ${maxCarYear}.`);
      Alert.alert("Год указан неправильно", `Можно указать год только от ${minCarYear} до ${maxCarYear}.`);
      return;
    }

    try {
      setSavingCar(true);
      setCarSaveStatus(carPhotos.length > 0 ? "Готовим фото к загрузке..." : "Отправляем данные автомобиля...");
      const body = new FormData();
      body.append("owner", String(profile.id));
      Object.entries(carForm).forEach(([key, value]) => {
        if (key !== "condition") {
          body.append(key, value);
        }
      });
      body.append("condition", carForm.tuning_details || "Не указано");
      for (const photo of carPhotos) {
        await appendImageToFormData(body, "uploaded_photos", photo);
      }

      setCarSaveStatus("Отправляем автомобиль на сервер...");
      if (editingCarId) {
        await updateCar(editingCarId, body);
      } else {
        const response = await fetch(`${API_BASE_URL}/cars/`, {
          method: "POST",
          body,
        });
        if (!response.ok) {
          throw new Error(await getApiError(response));
        }
      }
      setCarSaveStatus("Автомобиль сохранен.");
      setCarForm(initialCarForm);
      setCarPhotos([]);
      setAddingCar(false);
      setEditingCarId(null);
      await refreshProfile(profile.id);
      Alert.alert("Автомобиль сохранен", "Теперь его можно выбрать при подаче заявки.");
    } catch (error) {
      setCarSaveStatus(error instanceof Error ? error.message : "Не получилось добавить автомобиль.");
      Alert.alert("Не получилось добавить автомобиль", error instanceof Error ? error.message : "Проверь API и попробуй еще раз.");
    } finally {
      setSavingCar(false);
    }
  }

  async function removeCar(car: ProfileCar) {
    if (!profile) {
      return;
    }

    const relatedApplications = carApplications(car.id);
    const confirmed = await confirmAction(
      "Удалить машину?",
      relatedApplications.length > 0
        ? `Вы оставили этой машиной заявку на участие в фестивале. Если удалить машину, связанные заявки тоже будут удалены, и нужно будет отправить заявку заново.`
        : `Вы действительно хотите удалить ${car.make} ${car.model}?`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteCar(car.id);
      await refreshProfile(profile.id);
    } catch (error) {
      Alert.alert("Не получилось удалить машину", error instanceof Error ? error.message : "Проверь API.");
    }
  }

  function updateProfileEditField(name: "full_name" | "telegram" | "city", value: string) {
    setProfileEditForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfileEdit() {
    if (!profile) {
      return;
    }
    if (!profileEditForm.full_name) {
      Alert.alert("Имя не заполнено", "Имя профиля не должно быть пустым.");
      return;
    }

    try {
      setSavingProfileEdit(true);
      const body = new FormData();
      body.append("full_name", profileEditForm.full_name);
      body.append("telegram", profileEditForm.telegram);
      body.append("city", profileEditForm.city);
      if (profilePhoto) {
        await appendImageToFormData(body, "photo", profilePhoto);
      }
      if (removeProfilePhoto) {
        body.append("remove_photo", "true");
      }
      const updated = await updateProfile(profile.id, body);
      setProfile(updated);
      setProfileEditForm({
        full_name: updated.full_name,
        telegram: updated.telegram,
        city: updated.city,
      });
      setProfilePhoto(null);
      setRemoveProfilePhoto(false);
      setEditingProfile(false);
      await refreshProfile(updated.id);
    } catch (error) {
      Alert.alert("Не получилось сохранить данные", error instanceof Error ? error.message : "Проверь API.");
    } finally {
      setSavingProfileEdit(false);
    }
  }

  async function logoutProfile() {
    await clearStoredProfileId();
    setProfile(null);
    setApplications([]);
    setSelectedCarIds([]);
    setAddingCar(false);
    setEditingProfile(false);
    setProfileSection("menu");
    setEditingCarId(null);
    setProfileForm(initialProfileForm);
    setPhoneCountry(defaultPhoneCountry);
    setPhoneCountryMenuOpen(false);
    setProfilePhoto(null);
    setRemoveProfilePhoto(false);
    setProfileEditForm({ full_name: "", telegram: "", city: "" });
  }

  function toggleCar(carId: number) {
    setSelectedCarIds((current) =>
      current.includes(carId) ? current.filter((id) => id !== carId) : [...current, carId],
    );
  }

  function openFestival(festivalId: number) {
    setSelectedFestivalId(festivalId);
    setSelectedCarIds([]);
    setCarsMenuOpen(false);
  }

  function closeFestival() {
    setSelectedFestivalId(null);
    setSelectedCarIds([]);
    setCarsMenuOpen(false);
    setCommentText("");
  }

  async function submitFestivalComment() {
    if (!profile) {
      setActiveTab("profile");
      Alert.alert("Нужен профиль", "Войди в профиль, чтобы оставить комментарий.");
      return;
    }
    if (!selectedFestival || !commentText.trim()) {
      return;
    }

    try {
      setSavingComment(true);
      await createFestivalComment({
        festival: selectedFestival.id,
        participant: profile.id,
        text: commentText.trim(),
      });
      setCommentText("");
      await loadFestivals();
    } catch (error) {
      Alert.alert("Комментарий не отправлен", error instanceof Error ? error.message : "Попробуй еще раз.");
    } finally {
      setSavingComment(false);
    }
  }

  async function removeFestivalComment(comment: FestivalComment) {
    if (!profile) {
      return;
    }
    const confirmed = await confirmAction("Удалить комментарий?", "Комментарий исчезнет из обсуждения фестиваля.");
    if (!confirmed) {
      return;
    }
    try {
      await deleteFestivalComment(comment.id, profile.id);
      await loadFestivals();
    } catch (error) {
      Alert.alert("Не получилось удалить", error instanceof Error ? error.message : "Попробуй еще раз.");
    }
  }

  async function submitApplication() {
    if (!profile) {
      setActiveTab("profile");
      Alert.alert("Нужен профиль", "Зарегистрируйся и добавь автомобиль перед подачей заявки.");
      return;
    }

    if (!selectedFestival) {
      Alert.alert("Фестиваль не выбран", "Открой фестиваль и попробуй еще раз.");
      return;
    }

    if (isFestivalEnded(selectedFestival, now)) {
      Alert.alert("Прием заявок закрыт", "Фестиваль уже завершен, отправить заявку нельзя.");
      return;
    }

    const selectedCars = profile.cars.filter((car) => selectedCarIds.includes(car.id));
    if (selectedCars.length === 0) {
      Alert.alert("Выбери автомобиль", "Можно выбрать один или несколько автомобилей из выпадающего списка.");
      return;
    }

    const firstCar = selectedCars[0];
    const body = new FormData();
    body.append("festival", String(selectedFestival.id));
    body.append("participant", String(profile.id));
    body.append("participant_name", profile.full_name);
    body.append("phone", profile.phone);
    body.append("telegram", profile.telegram);
    body.append("city", profile.city);
    body.append("car_make", selectedCars.map((car) => car.make).join(", "));
    body.append("car_model", selectedCars.map((car) => car.model).join(", "));
    body.append("car_year", String(firstCar.year));
    body.append("engine", selectedCars.map((car) => car.engine).join(", "));
    body.append("condition", selectedCars.map((car) => `${car.make} ${car.model}: ${car.tuning_details || car.condition}`).join("\n"));
    body.append("tuning_details", selectedCars.map((car) => car.tuning_details).filter(Boolean).join("\n"));
    selectedCars.forEach((car) => body.append("cars", String(car.id)));

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/applications/`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        throw new Error(await getApiError(response));
      }
      setSelectedCarIds([]);
      setCarsMenuOpen(false);
      await refreshProfile(profile.id);
      Alert.alert("Заявка отправлена", "Статус появится в профиле.");
      setActiveTab("profile");
      setSelectedFestivalId(null);
    } catch (error) {
      Alert.alert("Не получилось отправить", error instanceof Error ? error.message : "Проверь соединение с API и попробуй еще раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        {activeTab === "home" ? (
          <HomeScreen
            loading={loading}
            festivals={festivals}
            now={now}
            logoUrl={appSettings?.logo}
            selectedFestival={selectedFestival}
            profile={profile}
            selectedCarIds={selectedCarIds}
            carsMenuOpen={carsMenuOpen}
            commentText={commentText}
            savingComment={savingComment}
            submitting={submitting}
            onOpenFestival={openFestival}
            onBack={closeFestival}
            onToggleCar={toggleCar}
            onToggleCarsMenu={() => setCarsMenuOpen((value) => !value)}
            onSubmitApplication={submitApplication}
            onCommentTextChange={setCommentText}
            onSubmitComment={submitFestivalComment}
            onDeleteComment={removeFestivalComment}
            onGoProfile={() => setActiveTab("profile")}
          />
        ) : (
          <ProfileScreen
            authMode={authMode}
            logoUrl={appSettings?.logo}
            activeSection={profileSection}
            profile={profile}
            profileForm={profileForm}
            phoneCountry={phoneCountry}
            phoneCountryMenuOpen={phoneCountryMenuOpen}
            profileEditForm={profileEditForm}
            profilePhoto={profilePhoto}
            removeProfilePhoto={removeProfilePhoto}
            carForm={carForm}
            carPhotos={carPhotos}
            applications={applications}
            addingCar={addingCar}
            editingProfile={editingProfile}
            savingProfile={savingProfile}
            savingCar={savingCar}
            carSaveStatus={carSaveStatus}
            savingProfileEdit={savingProfileEdit}
            editingCarId={editingCarId}
            onSectionChange={setProfileSection}
            onAuthModeChange={setAuthMode}
            onProfileChange={updateProfileField}
            onPhoneCountryChange={selectPhoneCountry}
            onTogglePhoneCountryMenu={() => setPhoneCountryMenuOpen((value) => !value)}
            onProfileEditChange={updateProfileEditField}
            onPickProfilePhoto={pickProfilePhoto}
            onRemoveProfilePhoto={markProfilePhotoForRemoval}
            onCarChange={updateCarField}
            onSubmitAuth={submitAuth}
            onPickCarPhotos={pickCarPhotos}
            onAddCar={addCar}
            onStartAddCar={startAddCar}
            onStartEditCar={startEditCar}
            onCloseCarForm={closeCarForm}
            onDeleteCar={removeCar}
            onToggleEditProfile={() => setEditingProfile((value) => !value)}
            onSaveProfileEdit={saveProfileEdit}
            onLogout={logoutProfile}
          />
        )}
        <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      </View>
    </SafeAreaView>
  );
}

type HomeProps = {
  loading: boolean;
  festivals: Festival[];
  now: Date;
  logoUrl?: string;
  selectedFestival?: Festival;
  profile: Profile | null;
  selectedCarIds: number[];
  carsMenuOpen: boolean;
  commentText: string;
  savingComment: boolean;
  submitting: boolean;
  onOpenFestival: (festivalId: number) => void;
  onBack: () => void;
  onToggleCar: (carId: number) => void;
  onToggleCarsMenu: () => void;
  onSubmitApplication: () => void;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  onDeleteComment: (comment: FestivalComment) => void;
  onGoProfile: () => void;
};

function HomeScreen({
  loading,
  festivals,
  now,
  logoUrl,
  selectedFestival,
  profile,
  selectedCarIds,
  carsMenuOpen,
  commentText,
  savingComment,
  submitting,
  onOpenFestival,
  onBack,
  onToggleCar,
  onToggleCarsMenu,
  onSubmitApplication,
  onCommentTextChange,
  onSubmitComment,
  onDeleteComment,
  onGoProfile,
}: HomeProps) {
  if (selectedFestival) {
    return (
        <FestivalDetail
          festival={selectedFestival}
          profile={profile}
          logoUrl={logoUrl}
          now={now}
          selectedCarIds={selectedCarIds}
          carsMenuOpen={carsMenuOpen}
          commentText={commentText}
          savingComment={savingComment}
          submitting={submitting}
        onBack={onBack}
        onToggleCar={onToggleCar}
          onToggleCarsMenu={onToggleCarsMenu}
          onSubmitApplication={onSubmitApplication}
          onCommentTextChange={onCommentTextChange}
          onSubmitComment={onSubmitComment}
          onDeleteComment={onDeleteComment}
          onGoProfile={onGoProfile}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader title="Главная" logoUrl={logoUrl} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#E50914" />
          <Text style={styles.loaderText}>Загружаем фестивали</Text>
        </View>
      ) : festivals.length === 0 ? (
        <View style={styles.section}>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Фестивалей пока нет</Text>
            <Text style={styles.emptyText}>Когда организатор откроет прием заявок, фестиваль появится на главной.</Text>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Фестивали</Text>
          {festivals.map((festival) => (
            <FestivalCard key={festival.id} festival={festival} now={now} onPress={() => onOpenFestival(festival.id)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function FestivalCard({ festival, now, onPress }: { festival: Festival; now: Date; onPress: () => void }) {
  const date = new Date(festival.start_date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  const countdown = countdownParts(festival, now);

  return (
    <Pressable style={styles.festivalCard} onPress={onPress}>
      <FestivalCover festival={festival} height={210} />
      <View style={styles.festivalBody}>
        <CountdownCard countdown={countdown} />
        <Text style={styles.festivalMeta}>{date} · {festival.city}</Text>
        <Text style={styles.festivalTitle}>{festival.title}</Text>
        <View style={styles.statsRow}>
          {formatMoney(festival.prize_fund) && <Stat label="Призовой фонд" value={formatMoney(festival.prize_fund)!} />}
          {festival.car_slots !== null && <Stat label="Машин" value={String(festival.car_slots)} />}
        </View>
      </View>
    </Pressable>
  );
}

function CountdownCard({ countdown }: { countdown: ReturnType<typeof countdownParts> }) {
  if (countdown.state === "ended") {
    return (
      <View style={styles.countdownCard}>
        <Text style={styles.countdownStarted}>Фестиваль завершен</Text>
      </View>
    );
  }

  if (countdown.state === "started") {
    return (
      <View style={styles.countdownCard}>
        <Text style={styles.countdownStarted}>Фестиваль начался</Text>
      </View>
    );
  }

  return (
    <View style={styles.countdownCard}>
      <Text style={styles.countdownHeading}>До старта</Text>
      <View style={styles.countdownGrid}>
        <CountdownUnit value={countdown.days} label="дней" />
        <CountdownUnit value={countdown.hours} label="часов" />
        <CountdownUnit value={countdown.minutes} label="мин" />
        <CountdownUnit value={countdown.seconds} label="сек" active />
      </View>
    </View>
  );
}

function CountdownUnit({ value, label, active }: { value: string; label: string; active?: boolean }) {
  return (
    <View style={[styles.countdownUnit, active && styles.countdownUnitActive]}>
      <Text style={[styles.countdownNumber, active && styles.countdownNumberActive]}>{value}</Text>
      <Text style={[styles.countdownUnitLabel, active && styles.countdownUnitLabelActive]}>{label}</Text>
    </View>
  );
}

function FestivalDetail({
  festival,
  profile,
  logoUrl,
  now,
  selectedCarIds,
  carsMenuOpen,
  commentText,
  savingComment,
  submitting,
  onBack,
  onToggleCar,
  onToggleCarsMenu,
  onSubmitApplication,
  onCommentTextChange,
  onSubmitComment,
  onDeleteComment,
  onGoProfile,
}: {
  festival: Festival;
  profile: Profile | null;
  logoUrl?: string;
  now: Date;
  selectedCarIds: number[];
  carsMenuOpen: boolean;
  commentText: string;
  savingComment: boolean;
  submitting: boolean;
  onBack: () => void;
  onToggleCar: (carId: number) => void;
  onToggleCarsMenu: () => void;
  onSubmitApplication: () => void;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  onDeleteComment: (comment: FestivalComment) => void;
  onGoProfile: () => void;
}) {
  const date = new Date(festival.start_date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const selectedCars = profile?.cars.filter((car) => selectedCarIds.includes(car.id)) ?? [];
  const prizeFund = formatMoney(festival.prize_fund);
  const countdown = countdownParts(festival, now);
  const ended = isFestivalEnded(festival, now);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.detailTop}>
        <AppHeader title="Фестиваль" logoUrl={logoUrl} onBack={onBack} />
        <FestivalCover festival={festival} height={270} />
      </View>

      <View style={styles.detailPanel}>
        <Text style={styles.detailCity}>{festival.city}</Text>
        <Text style={styles.detailTitle}>{festival.title}</Text>
        {!!festival.description && <Text style={styles.detailText}>{festival.description}</Text>}
        <View style={styles.detailCountdownWrap}>
          <CountdownCard countdown={countdown} />
        </View>

        <View style={styles.statsRow}>
          <Stat label="Дата" value={date} />
          {festival.prize_places !== null && <Stat label="Призовых мест" value={String(festival.prize_places)} />}
        </View>
        <View style={styles.statsRow}>
          {prizeFund && <Stat label="Призовой фонд" value={prizeFund} />}
          {festival.car_slots !== null && <Stat label="Лимит машин" value={String(festival.car_slots)} />}
        </View>
      </View>

      <FestivalMediaGallery festival={festival} />
      <FestivalWinners festival={festival} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Заявка</Text>
        {ended ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Прием заявок закрыт</Text>
            <Text style={styles.emptyText}>Фестиваль завершен. Если организатор опубликует победителей, они будут показаны выше.</Text>
          </View>
        ) : !profile ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Нужен профиль</Text>
            <Text style={styles.emptyText}>Зарегистрируйся и добавь автомобили, чтобы оставить заявку.</Text>
            <Pressable style={styles.blackButton} onPress={onGoProfile}>
              <Text style={styles.blackButtonText}>Перейти в профиль</Text>
            </Pressable>
          </View>
        ) : profile.cars.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Нет автомобилей</Text>
            <Text style={styles.emptyText}>В профиле можно добавить один или несколько автомобилей.</Text>
            <Pressable style={styles.blackButton} onPress={onGoProfile}>
              <Text style={styles.blackButtonText}>Добавить автомобиль</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={styles.dropdownButton} onPress={onToggleCarsMenu}>
              <View>
                <Text style={styles.dropdownLabel}>Автомобили для участия</Text>
                <View style={styles.dropdownValueRow}>
                  <View style={styles.dropdownCarIcon}>
                    <View style={styles.dropdownCarBody} />
                    <View style={[styles.dropdownCarWheel, styles.dropdownCarWheelLeft]} />
                    <View style={[styles.dropdownCarWheel, styles.dropdownCarWheelRight]} />
                  </View>
                  <Text style={styles.dropdownValue}>
                    {selectedCars.length > 0
                      ? selectedCars.map((car) => `${car.make} ${car.model}`).join(", ")
                      : "Выбрать из профиля"}
                  </Text>
                </View>
              </View>
              <View style={[styles.dropdownChevron, carsMenuOpen && styles.dropdownChevronOpen]} />
            </Pressable>

            {carsMenuOpen && (
              <View style={styles.dropdownMenu}>
                {profile.cars.map((car) => (
                  <Pressable
                    key={car.id}
                    style={[styles.dropdownItem, selectedCarIds.includes(car.id) && styles.dropdownItemSelected]}
                    onPress={() => onToggleCar(car.id)}
                  >
                    <View style={styles.carInfo}>
                      <Text style={styles.carTitle}>{car.make} {car.model}</Text>
                      <Text style={styles.carMeta}>{car.year} · {car.engine}</Text>
                    </View>
                    <Text style={styles.checkMark}>{selectedCarIds.includes(car.id) ? "Выбрано" : "Выбрать"}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {selectedCars.length > 0 && (
              <View style={styles.selectedList}>
                {selectedCars.map((car) => (
                  <SelectedCar key={car.id} car={car} />
                ))}
              </View>
            )}

            <Pressable
              style={[styles.redButton, submitting && styles.buttonDisabled]}
              onPress={onSubmitApplication}
              disabled={submitting}
            >
              <Text style={styles.redButtonText}>{submitting ? "Отправляем..." : "Оставить заявку"}</Text>
            </Pressable>
          </>
        )}
      </View>

      <FestivalComments
        festival={festival}
        profile={profile}
        commentText={commentText}
        savingComment={savingComment}
        onCommentTextChange={onCommentTextChange}
        onSubmitComment={onSubmitComment}
        onDeleteComment={onDeleteComment}
        onGoProfile={onGoProfile}
      />
    </ScrollView>
  );
}

function FestivalMediaGallery({ festival }: { festival: Festival }) {
  const mediaItems = festival.media_items ?? [];

  if (mediaItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.mediaSection}>
      <View style={[styles.sectionHeaderRow, styles.mediaHeader]}>
        <Text style={styles.sectionTitle}>Новости фестиваля</Text>
        <Text style={styles.mediaCount}>{mediaItems.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRail}>
        {mediaItems.map((item) => {
          const fileUrl = mediaUrl(item.file) ?? "";

          return (
            <View key={item.id} style={styles.mediaCard}>
              <View style={styles.mediaFrame}>
                {item.media_type === "video" ? (
                  <FestivalVideo uri={fileUrl} />
                ) : (
                  <Image source={{ uri: fileUrl }} style={styles.mediaVisual} />
                )}
                <View style={styles.mediaTypeBadge}>
                  <Text style={styles.mediaTypeText}>{item.media_type === "video" ? "Видео" : "Фото"}</Text>
                </View>
              </View>
              <View style={styles.mediaBody}>
                <Text style={styles.mediaTitle}>{item.title || festival.title}</Text>
                {!!item.description && <Text style={styles.mediaDescription}>{item.description}</Text>}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function FestivalWinners({ festival }: { festival: Festival }) {
  const winners = festival.winners ?? [];

  if (winners.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Победители</Text>
      {winners.map((winner) => (
        <View key={winner.id} style={styles.winnerCard}>
          {winner.image ? (
            <Image source={{ uri: mediaUrl(winner.image) ?? "" }} style={styles.winnerImage} />
          ) : (
            <View style={styles.winnerImageEmpty}>
              <Text style={styles.winnerPlace}>{winner.place}</Text>
            </View>
          )}
          <View style={styles.winnerBody}>
            <Text style={styles.winnerBadge}>{winner.place} место</Text>
            <Text style={styles.winnerTitle}>{winner.title}</Text>
            {!!winner.participant_name && <Text style={styles.winnerMeta}>{winner.participant_name}</Text>}
            {!!winner.car_name && <Text style={styles.winnerMeta}>{winner.car_name}</Text>}
            {!!winner.description && <Text style={styles.winnerText}>{winner.description}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

function FestivalComments({
  festival,
  profile,
  commentText,
  savingComment,
  onCommentTextChange,
  onSubmitComment,
  onDeleteComment,
  onGoProfile,
}: {
  festival: Festival;
  profile: Profile | null;
  commentText: string;
  savingComment: boolean;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  onDeleteComment: (comment: FestivalComment) => void;
  onGoProfile: () => void;
}) {
  const comments = festival.comments ?? [];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Комментарии</Text>
      {profile ? (
        <View style={styles.commentForm}>
          <TextInput
            value={commentText}
            onChangeText={onCommentTextChange}
            placeholder="Написать комментарий"
            placeholderTextColor="#8E8E98"
            multiline
            style={styles.commentInput}
          />
          <Pressable
            style={[styles.redButton, (!commentText.trim() || savingComment) && styles.buttonDisabled]}
            onPress={onSubmitComment}
            disabled={!commentText.trim() || savingComment}
          >
            <Text style={styles.redButtonText}>{savingComment ? "Отправляем..." : "Оставить комментарий"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Войдите в профиль</Text>
          <Text style={styles.emptyText}>После входа можно оставить комментарий к фестивалю.</Text>
          <Pressable style={styles.blackButton} onPress={onGoProfile}>
            <Text style={styles.blackButtonText}>Перейти в профиль</Text>
          </Pressable>
        </View>
      )}

      {comments.length === 0 ? (
        <Text style={styles.commentsEmpty}>Комментариев пока нет</Text>
      ) : (
        <View style={styles.commentsList}>
          {comments.map((comment) => {
            const ownComment = profile?.id === comment.participant;
            return (
              <View key={comment.id} style={styles.commentCard}>
                {comment.participant_photo ? (
                  <Image source={{ uri: mediaUrl(comment.participant_photo) ?? "" }} style={styles.commentAvatar} />
                ) : (
                  <View style={styles.commentAvatarEmpty}>
                    <Text style={styles.commentAvatarText}>{comment.participant_name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.commentBody}>
                  <View style={styles.commentTop}>
                    <View style={styles.commentInfo}>
                      <Text style={styles.commentName}>{comment.participant_name}</Text>
                      <Text style={styles.commentDate}>{new Date(comment.created_at).toLocaleDateString("ru-RU")}</Text>
                    </View>
                    {ownComment && (
                      <Pressable style={styles.commentDeleteButton} onPress={() => onDeleteComment(comment)}>
                        <Text style={styles.commentDeleteText}>Удалить</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function FestivalVideo({ uri }: { uri: string }) {
  const videoRef = useRef<Video>(null);

  async function lockFullscreenOrientation() {
    try {
      if (Platform.OS !== "web") {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
    } catch {
      // Video playback should keep working even if orientation lock fails.
    }
  }

  async function unlockFullscreenOrientation() {
    try {
      if (Platform.OS !== "web") {
        await ScreenOrientation.unlockAsync();
      }
    } catch {
      // Video playback should keep working even if orientation unlock fails.
    }
  }

  return (
    <View style={styles.mediaVideoWrap}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.mediaVisual}
        resizeMode={ResizeMode.COVER}
        useNativeControls
        shouldPlay={false}
        onFullscreenUpdate={(event) => {
          if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_WILL_PRESENT) {
            lockFullscreenOrientation();
          }
          if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_DISMISS) {
            unlockFullscreenOrientation();
          }
        }}
      />
    </View>
  );
}

function FestivalCover({ festival, height }: { festival: Festival; height: number }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [coverWidth, setCoverWidth] = useState(0);
  const carouselRef = useRef<ScrollView>(null);
  const slides = (festival.cover_slides ?? [])
    .slice(0, 5)
    .map((slide) => slide.image);
  const fallbackSlide = festival.cover_image ? [festival.cover_image] : [];
  const coverSlides = slides.length > 0 ? slides : fallbackSlide;

  useEffect(() => {
    if (coverSlides.length <= 1 || coverWidth <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setActiveSlide((current) => {
        const next = (current + 1) % coverSlides.length;
        carouselRef.current?.scrollTo({ x: next * coverWidth, animated: true });
        return next;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [coverSlides.length, coverWidth]);

  function updateActiveSlide(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const slideWidth = event.nativeEvent.layoutMeasurement.width;
    if (slideWidth <= 0) {
      return;
    }
    setActiveSlide(Math.round(event.nativeEvent.contentOffset.x / slideWidth));
  }

  return (
    <View
      style={[styles.cover, { height }]}
      onLayout={(event) => setCoverWidth(event.nativeEvent.layout.width)}
    >
      {coverSlides.length > 0 ? (
        <>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={updateActiveSlide}
            style={styles.coverCarousel}
          >
            {coverSlides.map((slide, index) => (
              <View key={`${slide}-${index}`} style={[styles.coverSlide, { width: coverWidth || 1 }]}>
                <Image source={{ uri: mediaUrl(slide) ?? "" }} style={styles.coverImage} />
              </View>
            ))}
          </ScrollView>
          {coverSlides.length > 1 && (
            <View style={styles.coverDots}>
              {coverSlides.map((slide, index) => (
                <View key={`${slide}-dot-${index}`} style={[styles.coverDot, index === activeSlide && styles.coverDotActive]} />
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.coverFallback}>
          <Text style={styles.coverText}>MAJOR</Text>
          <Text style={styles.coverTextMuted}>FEST</Text>
        </View>
      )}
      <View style={styles.coverShade} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SelectedCar({ car }: { car: ProfileCar }) {
  return (
    <View style={styles.selectedCar}>
      {car.main_photo ? (
        <Image source={{ uri: mediaUrl(car.main_photo) ?? "" }} style={styles.selectedCarImage} />
      ) : (
        <View style={styles.selectedCarImageEmpty} />
      )}
      <View style={styles.carInfo}>
        <Text style={styles.carTitle}>{car.make} {car.model}</Text>
        <Text style={styles.carMeta}>{car.year} · {car.engine}</Text>
      </View>
    </View>
  );
}

type ProfileProps = {
  authMode: "login" | "register";
  logoUrl?: string;
  activeSection: ProfileSection;
  profile: Profile | null;
  profileForm: ProfileForm;
  phoneCountry: typeof defaultPhoneCountry;
  phoneCountryMenuOpen: boolean;
  profileEditForm: { full_name: string; telegram: string; city: string };
  profilePhoto: ImagePicker.ImagePickerAsset | null;
  removeProfilePhoto: boolean;
  carForm: CarForm;
  carPhotos: ImagePicker.ImagePickerAsset[];
  applications: Application[];
  addingCar: boolean;
  editingProfile: boolean;
  savingProfile: boolean;
  savingCar: boolean;
  carSaveStatus: string;
  savingProfileEdit: boolean;
  editingCarId: number | null;
  onSectionChange: (section: ProfileSection) => void;
  onAuthModeChange: (mode: "login" | "register") => void;
  onProfileChange: (name: keyof ProfileForm, value: string) => void;
  onPhoneCountryChange: (country: typeof defaultPhoneCountry) => void;
  onTogglePhoneCountryMenu: () => void;
  onProfileEditChange: (name: "full_name" | "telegram" | "city", value: string) => void;
  onPickProfilePhoto: () => void;
  onRemoveProfilePhoto: () => void;
  onCarChange: (name: keyof CarForm, value: string) => void;
  onSubmitAuth: () => void;
  onPickCarPhotos: () => void;
  onAddCar: () => void;
  onStartAddCar: () => void;
  onStartEditCar: (car: ProfileCar) => void;
  onCloseCarForm: () => void;
  onDeleteCar: (car: ProfileCar) => void;
  onToggleEditProfile: () => void;
  onSaveProfileEdit: () => void;
  onLogout: () => void;
};

function ProfileScreen({
  authMode,
  logoUrl,
  activeSection,
  profile,
  profileForm,
  phoneCountry,
  phoneCountryMenuOpen,
  profileEditForm,
  profilePhoto,
  removeProfilePhoto,
  carForm,
  carPhotos,
  applications,
  addingCar,
  editingProfile,
  savingProfile,
  savingCar,
  carSaveStatus,
  savingProfileEdit,
  editingCarId,
  onSectionChange,
  onAuthModeChange,
  onProfileChange,
  onPhoneCountryChange,
  onTogglePhoneCountryMenu,
  onProfileEditChange,
  onPickProfilePhoto,
  onRemoveProfilePhoto,
  onCarChange,
  onSubmitAuth,
  onPickCarPhotos,
  onAddCar,
  onStartAddCar,
  onStartEditCar,
  onCloseCarForm,
  onDeleteCar,
  onToggleEditProfile,
  onSaveProfileEdit,
  onLogout,
}: ProfileProps) {
  if (!profile) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader title="Профиль" logoUrl={logoUrl} />

        <View style={styles.section}>
          <View style={styles.authSwitch}>
            <Pressable
              style={[styles.authSwitchButton, authMode === "login" && styles.authSwitchButtonActive]}
              onPress={() => onAuthModeChange("login")}
            >
              <Text style={[styles.authSwitchText, authMode === "login" && styles.authSwitchTextActive]}>Войти</Text>
            </Pressable>
            <Pressable
              style={[styles.authSwitchButton, authMode === "register" && styles.authSwitchButtonActive]}
              onPress={() => onAuthModeChange("register")}
            >
              <Text style={[styles.authSwitchText, authMode === "register" && styles.authSwitchTextActive]}>Регистрация</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>{authMode === "login" ? "Вход" : "Новый профиль"}</Text>
          {authMode === "register" && (
            <Field label="Имя" value={profileForm.full_name} onChangeText={(value) => onProfileChange("full_name", value)} />
          )}
          <PhoneField
            country={phoneCountry}
            menuOpen={phoneCountryMenuOpen}
            value={profileForm.phone_digits}
            onChangeText={(value) => onProfileChange("phone_digits", value)}
            onCountryChange={onPhoneCountryChange}
            onToggleMenu={onTogglePhoneCountryMenu}
          />
          <Field label="Пароль" value={profileForm.password} secureTextEntry onChangeText={(value) => onProfileChange("password", value)} />
          {authMode === "register" && (
            <Field
              label="Подтверждение пароля"
              value={profileForm.password_confirm}
              secureTextEntry
              onChangeText={(value) => onProfileChange("password_confirm", value)}
            />
          )}
          <Pressable style={styles.redButton} onPress={onSubmitAuth} disabled={savingProfile}>
            <Text style={styles.redButtonText}>{savingProfile ? "Проверяем..." : authMode === "login" ? "Войти" : "Зарегистрироваться"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader title="Профиль" logoUrl={logoUrl} />

      {activeSection === "menu" ? (
        <View style={styles.section}>
          <ProfileMenuButton title="Мои данные" subtitle="Имя, телефон, Telegram и город" onPress={() => onSectionChange("data")} />
          <ProfileMenuButton title="Мои машины" subtitle={`${profile.cars.length} добавлено`} onPress={() => onSectionChange("cars")} />
          <ProfileMenuButton title="Мои заявки" subtitle={`${applications.length} заявок`} onPress={() => onSectionChange("applications")} />
          <Pressable style={styles.logoutWideButton} onPress={onLogout}>
            <Text style={styles.logoutWideButtonText}>Выйти</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.section}>
          <Pressable style={styles.backInlineButton} onPress={() => onSectionChange("menu")}>
            <Text style={styles.backInlineButtonText}>Назад</Text>
          </Pressable>

          {activeSection === "data" && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Мои данные</Text>
                <Pressable style={styles.smallBlackButton} onPress={onToggleEditProfile}>
                  <Text style={styles.smallBlackButtonText}>{editingProfile ? "Закрыть" : "Редактировать"}</Text>
                </Pressable>
              </View>
              {editingProfile ? (
                <View style={styles.formBlock}>
                  <ProfilePhotoEditor
                    profile={profile}
                    selectedPhoto={profilePhoto}
                    removePhoto={removeProfilePhoto}
                    onPickPhoto={onPickProfilePhoto}
                    onRemovePhoto={onRemoveProfilePhoto}
                  />
                  <Field label="Имя" value={profileEditForm.full_name} onChangeText={(value) => onProfileEditChange("full_name", value)} />
                  <Field label="Telegram" value={profileEditForm.telegram} onChangeText={(value) => onProfileEditChange("telegram", value)} />
                  <Field label="Город" value={profileEditForm.city} onChangeText={(value) => onProfileEditChange("city", value)} />
                  <Pressable style={styles.redButton} onPress={onSaveProfileEdit} disabled={savingProfileEdit}>
                    <Text style={styles.redButtonText}>{savingProfileEdit ? "Сохраняем..." : "Сохранить данные"}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.dataCard}>
                  <View style={styles.profilePhotoPreviewRow}>
                    {profile.photo ? (
                      <Image source={{ uri: mediaUrl(profile.photo) ?? "" }} style={styles.profilePhotoPreview} />
                    ) : (
                      <View style={styles.profilePhotoEmpty}>
                        <Text style={styles.profilePhotoEmptyText}>{profile.full_name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.profilePhotoPreviewText}>
                      <Text style={styles.dataLabel}>Фото профиля</Text>
                      <Text style={styles.dataValue}>{profile.photo ? "Загружено" : "Не загружено"}</Text>
                    </View>
                  </View>
                  <DataRow label="Имя" value={profile.full_name} />
                  <DataRow label="Телефон" value={profile.phone} />
                  <DataRow label="Telegram" value={profile.telegram || "Не указан"} />
                  <DataRow label="Город" value={profile.city || "Не указан"} />
                </View>
              )}
            </>
          )}

          {activeSection === "cars" && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Мои машины</Text>
                {addingCar ? (
                  <Pressable style={styles.smallBlackButton} onPress={onCloseCarForm}>
                    <Text style={styles.smallBlackButtonText}>Закрыть</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.smallRedButton} onPress={onStartAddCar}>
                    <Text style={styles.smallRedButtonText}>Добавить</Text>
                  </Pressable>
                )}
              </View>

              {profile.cars.length === 0 && !addingCar && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>Автомобилей пока нет</Text>
                  <Text style={styles.emptyText}>Добавь автомобиль, чтобы потом выбрать его в заявке на фестиваль.</Text>
                </View>
              )}

              {!addingCar && profile.cars.map((car) => (
                <ProfileCarCard key={car.id} car={car} onEdit={onStartEditCar} onDelete={onDeleteCar} />
              ))}

              {addingCar && (
                <View style={styles.formBlock}>
                  <Text style={styles.formTitle}>{editingCarId ? "Редактировать машину" : "Новая машина"}</Text>
                  <View style={styles.row}>
                    <Field label="Марка" value={carForm.make} placeholder="BMW" onChangeText={(value) => onCarChange("make", value)} half />
                    <Field label="Модель" value={carForm.model} placeholder="M5 Competition" onChangeText={(value) => onCarChange("model", value)} half />
                  </View>
                  <View style={styles.row}>
                    <Field label="Год" value={carForm.year} placeholder="2020" keyboardType="number-pad" onChangeText={(value) => onCarChange("year", value)} half />
                    <Field label="Мотор" value={carForm.engine} placeholder="4.4 V8 Twin Turbo" onChangeText={(value) => onCarChange("engine", value)} half />
                  </View>
                  <Field label="Тюнинг и особенности" value={carForm.tuning_details} placeholder="Например: Stage 2, выхлоп, диски, аэродинамика" multiline onChangeText={(value) => onCarChange("tuning_details", value)} />
                  <Pressable style={styles.photoButton} onPress={onPickCarPhotos}>
                    <Text style={styles.photoButtonText}>
                      {carPhotos.length > 0 ? `Фото выбрано: ${carPhotos.length}/5` : "Выбрать до 5 фото"}
                    </Text>
                  </Pressable>
                  {carPhotos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoPreviewList}>
                      {carPhotos.map((photo) => (
                        <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.newCarPreview} />
                      ))}
                    </ScrollView>
                  )}
                  <Pressable style={styles.redButton} onPress={onAddCar} disabled={savingCar}>
                    <Text style={styles.redButtonText}>{savingCar ? "Сохраняем..." : editingCarId ? "Сохранить изменения" : "Сохранить автомобиль"}</Text>
                  </Pressable>
                  {!!carSaveStatus && <Text style={styles.formStatus}>{carSaveStatus}</Text>}
                </View>
              )}
            </>
          )}

          {activeSection === "applications" && (
            <>
              <Text style={styles.sectionTitle}>Мои заявки</Text>
              {applications.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>Заявок пока нет</Text>
                  <Text style={styles.emptyText}>После отправки заявки ее статус будет показан здесь.</Text>
                </View>
              ) : (
                applications.map((application) => (
                  <View key={application.id} style={styles.applicationCard}>
                    <View style={styles.applicationTop}>
                      <Text style={styles.applicationTitle}>Заявка #{application.id}</Text>
                      <View style={[styles.statusBadge, applicationStatusStyles[application.status]]}>
                        <Text style={styles.statusText}>{statusLabels[application.status]}</Text>
                      </View>
                    </View>
                    <Text style={styles.applicationMeta}>
                      {application.cars_detail.map((car) => `${car.make} ${car.model}`).join(", ")}
                    </Text>
                    {!!application.moderator_note && <Text style={styles.note}>{application.moderator_note}</Text>}
                  </View>
                ))
              )}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function ProfileCarCard({
  car,
  onEdit,
  onDelete,
}: {
  car: ProfileCar;
  onEdit: (car: ProfileCar) => void;
  onDelete: (car: ProfileCar) => void;
}) {
  const gallery = car.photos?.length ? car.photos : [];

  return (
    <View style={styles.profileCarCard}>
      {car.main_photo ? (
        <Image source={{ uri: mediaUrl(car.main_photo) ?? "" }} style={styles.profileCarImage} />
      ) : (
        <View style={styles.profileCarImageEmpty}>
          <Text style={styles.profileCarImageText}>{car.make}</Text>
        </View>
      )}
      <View style={styles.profileCarBody}>
        <Text style={styles.carTitle}>{car.make} {car.model}</Text>
        <Text style={styles.carMeta}>{car.year} · {car.engine}</Text>
        {!!car.tuning_details && <Text style={styles.carDescription}>{car.tuning_details}</Text>}
        {gallery.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carGallery}>
            {gallery.map((photo) => (
              <Image key={photo.id} source={{ uri: mediaUrl(photo.image) ?? "" }} style={styles.carGalleryImage} />
            ))}
          </ScrollView>
        )}
        <View style={styles.carActions}>
          <Pressable style={styles.carActionButton} onPress={() => onEdit(car)}>
            <Text style={styles.carActionText}>Редактировать</Text>
          </Pressable>
          <Pressable style={styles.carDeleteButton} onPress={() => onDelete(car)}>
            <Text style={styles.carDeleteText}>Удалить</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ProfilePhotoEditor({
  profile,
  selectedPhoto,
  removePhoto,
  onPickPhoto,
  onRemovePhoto,
}: {
  profile: Profile;
  selectedPhoto: ImagePicker.ImagePickerAsset | null;
  removePhoto: boolean;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
}) {
  const previewUri = selectedPhoto?.uri || (!removePhoto ? mediaUrl(profile.photo) : undefined);

  return (
    <View style={styles.profilePhotoEditor}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.profilePhotoLarge} />
      ) : (
        <View style={styles.profilePhotoLargeEmpty}>
          <Text style={styles.profilePhotoLargeText}>{profile.full_name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.profilePhotoActions}>
        <Pressable style={styles.smallBlackButton} onPress={onPickPhoto}>
          <Text style={styles.smallBlackButtonText}>{previewUri ? "Заменить фото" : "Загрузить фото"}</Text>
        </Pressable>
        {previewUri && (
          <Pressable style={styles.profilePhotoDeleteButton} onPress={onRemovePhoto}>
            <Text style={styles.profilePhotoDeleteText}>Удалить фото</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ProfileMenuButton({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={styles.profileMenuButton} onPress={onPress}>
      <View>
        <Text style={styles.profileMenuTitle}>{title}</Text>
        <Text style={styles.profileMenuSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.profileMenuArrow}>›</Text>
    </Pressable>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function BottomTabs({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.tabs}>
      <Pressable style={[styles.tabButton, activeTab === "home" && styles.tabButtonActive]} onPress={() => onChange("home")}>
        <Text style={[styles.tabIcon, activeTab === "home" && styles.tabIconActive]}>⌂</Text>
        <Text style={[styles.tabText, activeTab === "home" && styles.tabTextActive]}>Главная</Text>
      </Pressable>
      <Pressable style={[styles.tabButton, activeTab === "profile" && styles.tabButtonActive]} onPress={() => onChange("profile")}>
        <Text style={[styles.tabIcon, activeTab === "profile" && styles.tabIconActive]}>◉</Text>
        <Text style={[styles.tabText, activeTab === "profile" && styles.tabTextActive]}>Профиль</Text>
      </Pressable>
    </View>
  );
}

function AppHeader({ title, logoUrl, onBack }: { title: string; logoUrl?: string; onBack?: () => void }) {
  const source = logoUrl ? { uri: mediaUrl(logoUrl) ?? logoUrl } : require("./assets/logo_major.png");

  return (
    <View style={styles.appHeader}>
      <View style={styles.logoRow}>
        <Image source={source} style={styles.logoImage} />
        <View>
          <Text style={styles.logoTitle}>MAJOR</Text>
          <Text style={styles.logoSubtitle}>FEST</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        {onBack && (
          <Pressable style={styles.headerBackButton} onPress={onBack}>
            <Text style={styles.headerBackText}>Назад</Text>
          </Pressable>
        )}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  half?: boolean;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "phone-pad" | "number-pad";
};

function Field({ label, value, onChangeText, placeholder, half, multiline, secureTextEntry, keyboardType = "default" }: FieldProps) {
  return (
    <View style={[styles.field, half && styles.fieldHalf]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        placeholderTextColor="#8E8E98"
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function PhoneField({
  country,
  menuOpen,
  value,
  onChangeText,
  onCountryChange,
  onToggleMenu,
}: {
  country: typeof defaultPhoneCountry;
  menuOpen: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onCountryChange: (country: typeof defaultPhoneCountry) => void;
  onToggleMenu: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Телефон</Text>
      <View style={styles.phoneInputWrap}>
        <Pressable style={styles.countryButton} onPress={onToggleMenu}>
          <Text style={styles.countryFlag}>{country.flag}</Text>
          <Text style={styles.countryCode}>{country.dialCode}</Text>
          <View style={[styles.countryChevron, menuOpen && styles.countryChevronOpen]} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          maxLength={country.digits}
          placeholder={country.example}
          placeholderTextColor="#8E8E98"
          style={styles.phoneInput}
        />
      </View>
      {menuOpen && (
        <View style={styles.countryMenu}>
          {phoneCountries.map((item) => (
            <Pressable
              key={item.code}
              style={[styles.countryMenuItem, item.code === country.code && styles.countryMenuItemActive]}
              onPress={() => onCountryChange(item)}
            >
              <View style={styles.countryMenuLeft}>
                <Text style={styles.countryMenuFlag}>{item.flag}</Text>
                <View>
                  <Text style={styles.countryMenuName}>{item.name}</Text>
                  <Text style={styles.countryMenuFormat}>{item.dialCode} · {item.digits} цифр</Text>
                </View>
              </View>
              <Text style={styles.countryMenuCode}>{item.dialCode}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#08080A",
  },
  screen: {
    flex: 1,
    backgroundColor: "#F6F6F7",
  },
  content: {
    paddingBottom: 104,
  },
  appHeader: {
    backgroundColor: "#08080A",
    paddingHorizontal: 22,
    paddingTop: Platform.select({ ios: 20, android: 42, default: 30 }),
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "right",
  },
  headerBackButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: "#1A1A1F",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  headerBackText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  hero: {
    backgroundColor: "#08080A",
    paddingHorizontal: 22,
    paddingTop: Platform.select({ ios: 20, android: 42, default: 30 }),
    paddingBottom: 22,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoImage: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#111114",
  },
  logoTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  logoSubtitle: {
    color: "#E50914",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 1,
  },
  profileHero: {
    backgroundColor: "#08080A",
    paddingHorizontal: 22,
    paddingTop: Platform.select({ ios: 20, android: 42, default: 30 }),
    paddingBottom: 30,
  },
  brand: {
    color: "#E50914",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 14,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    maxWidth: 360,
  },
  heroText: {
    color: "#B8B8C0",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 370,
  },
  profileName: {
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
  },
  profileMeta: {
    color: "#B8B8C0",
    fontSize: 15,
    marginTop: 8,
  },
  logoutButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3A3A42",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 16,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  loader: {
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  loaderText: {
    color: "#5D5D66",
  },
  section: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#111114",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 14,
  },
  authSwitch: {
    flexDirection: "row",
    backgroundColor: "#EDEDF0",
    borderRadius: 8,
    padding: 4,
    marginBottom: 18,
  },
  authSwitchButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  authSwitchButtonActive: {
    backgroundColor: "#111114",
  },
  authSwitchText: {
    color: "#5F5F68",
    fontSize: 14,
    fontWeight: "900",
  },
  authSwitchTextActive: {
    color: "#FFFFFF",
  },
  emptyBox: {
    borderWidth: 1,
    borderColor: "#E2E2E6",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  emptyTitle: {
    color: "#111114",
    fontSize: 16,
    fontWeight: "900",
  },
  emptyText: {
    color: "#6D6D76",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  profileMenuButton: {
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  profileMenuTitle: {
    color: "#111114",
    fontSize: 17,
    fontWeight: "900",
  },
  profileMenuSubtitle: {
    color: "#6D6D76",
    fontSize: 13,
    marginTop: 5,
  },
  profileMenuArrow: {
    color: "#E50914",
    fontSize: 28,
    fontWeight: "900",
  },
  logoutWideButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111114",
    marginTop: 12,
  },
  logoutWideButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  backInlineButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#111114",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  backInlineButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  dataCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  dataRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFF2",
  },
  dataLabel: {
    color: "#777782",
    fontSize: 13,
    fontWeight: "800",
  },
  dataValue: {
    flex: 1,
    color: "#111114",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  profilePhotoPreviewRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFF2",
  },
  profilePhotoPreview: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#111114",
  },
  profilePhotoEmpty: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#111114",
    alignItems: "center",
    justifyContent: "center",
  },
  profilePhotoEmptyText: {
    color: "#E50914",
    fontSize: 22,
    fontWeight: "900",
  },
  profilePhotoPreviewText: {
    flex: 1,
  },
  profilePhotoEditor: {
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  profilePhotoLarge: {
    width: 112,
    height: 112,
    borderRadius: 8,
    backgroundColor: "#111114",
  },
  profilePhotoLargeEmpty: {
    width: 112,
    height: 112,
    borderRadius: 8,
    backgroundColor: "#111114",
    alignItems: "center",
    justifyContent: "center",
  },
  profilePhotoLargeText: {
    color: "#E50914",
    fontSize: 42,
    fontWeight: "900",
  },
  profilePhotoActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  profilePhotoDeleteButton: {
    minHeight: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFE0E0",
    paddingHorizontal: 12,
  },
  profilePhotoDeleteText: {
    color: "#C4000B",
    fontSize: 13,
    fontWeight: "900",
  },
  festivalCard: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E4E8",
    overflow: "hidden",
    marginBottom: 16,
  },
  cover: {
    backgroundColor: "#111114",
    overflow: "hidden",
  },
  coverCarousel: {
    flex: 1,
  },
  coverSlide: {
    height: "100%",
    backgroundColor: "#111114",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverDots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  coverDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  coverDotActive: {
    width: 20,
    backgroundColor: "#E50914",
  },
  coverFallback: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#111114",
  },
  coverText: {
    color: "#E50914",
    fontSize: 42,
    fontWeight: "900",
  },
  coverTextMuted: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "900",
    marginTop: -8,
  },
  coverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  festivalBody: {
    padding: 16,
  },
  countdownCard: {
    alignSelf: "stretch",
    borderRadius: 8,
    backgroundColor: "#111114",
    padding: 12,
    marginBottom: 14,
  },
  countdownHeading: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 10,
  },
  countdownGrid: {
    flexDirection: "row",
    gap: 8,
  },
  countdownUnit: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: "#1A1A1F",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A2A31",
  },
  countdownUnitActive: {
    borderColor: "#E50914",
    backgroundColor: "#24090C",
  },
  countdownNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
  },
  countdownNumberActive: {
    color: "#E50914",
  },
  countdownUnitLabel: {
    color: "#B8B8C0",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  countdownUnitLabelActive: {
    color: "#FFFFFF",
  },
  countdownStarted: {
    color: "#E50914",
    fontSize: 18,
    fontWeight: "900",
  },
  festivalTitle: {
    color: "#111114",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    marginTop: 6,
  },
  festivalMeta: {
    color: "#6D6D76",
    fontSize: 14,
    fontWeight: "700",
  },
  detailTop: {
    backgroundColor: "#08080A",
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1A1A1F",
    marginBottom: 14,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  detailPanel: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 6,
  },
  detailCity: {
    color: "#E50914",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
  },
  detailTitle: {
    color: "#111114",
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
  },
  detailText: {
    color: "#5D5D66",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  detailCountdownWrap: {
    marginTop: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  statBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  statLabel: {
    color: "#777782",
    fontSize: 12,
    fontWeight: "800",
  },
  statValue: {
    color: "#111114",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 6,
  },
  mediaSection: {
    paddingTop: 18,
    paddingBottom: 10,
  },
  mediaHeader: {
    paddingHorizontal: 18,
  },
  mediaCount: {
    minWidth: 34,
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: "#E50914",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    textAlignVertical: "center",
    paddingTop: Platform.select({ ios: 7, android: 0, default: 7 }),
  },
  mediaRail: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 12,
  },
  mediaCard: {
    width: 290,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  mediaFrame: {
    height: 190,
    backgroundColor: "#111114",
  },
  mediaVisual: {
    width: "100%",
    height: "100%",
  },
  mediaVideoWrap: {
    width: "100%",
    height: "100%",
  },
  mediaTypeBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: "rgba(8,8,10,0.82)",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  mediaTypeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  mediaBody: {
    padding: 13,
  },
  mediaTitle: {
    color: "#111114",
    fontSize: 16,
    fontWeight: "900",
  },
  mediaDescription: {
    color: "#656570",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  winnerCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginBottom: 12,
  },
  winnerImage: {
    width: "100%",
    height: 170,
    backgroundColor: "#111114",
  },
  winnerImageEmpty: {
    width: "100%",
    height: 96,
    backgroundColor: "#111114",
    alignItems: "center",
    justifyContent: "center",
  },
  winnerPlace: {
    color: "#E50914",
    fontSize: 34,
    fontWeight: "900",
  },
  winnerBody: {
    padding: 14,
  },
  winnerBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: "#FFF1F2",
    color: "#E50914",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginBottom: 10,
  },
  winnerTitle: {
    color: "#111114",
    fontSize: 18,
    fontWeight: "900",
  },
  winnerMeta: {
    color: "#686872",
    fontSize: 14,
    marginTop: 5,
  },
  winnerText: {
    color: "#5D5D66",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  commentForm: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 14,
  },
  commentInput: {
    minHeight: 86,
    color: "#111114",
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: "top",
  },
  commentsEmpty: {
    color: "#6D6D76",
    fontSize: 14,
    marginTop: 4,
  },
  commentsList: {
    gap: 10,
  },
  commentCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  commentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#111114",
  },
  commentAvatarEmpty: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#111114",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    color: "#E50914",
    fontSize: 17,
    fontWeight: "900",
  },
  commentBody: {
    flex: 1,
  },
  commentTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  commentInfo: {
    flex: 1,
  },
  commentName: {
    color: "#111114",
    fontSize: 14,
    fontWeight: "900",
  },
  commentDate: {
    color: "#8A8A94",
    fontSize: 12,
    marginTop: 3,
  },
  commentDeleteButton: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: "#FFE0E0",
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  commentDeleteText: {
    color: "#C4000B",
    fontSize: 12,
    fontWeight: "900",
  },
  commentText: {
    color: "#4B4B54",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 9,
  },
  dropdownButton: {
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DADAE0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dropdownLabel: {
    color: "#777782",
    fontSize: 12,
    fontWeight: "900",
  },
  dropdownValue: {
    flex: 1,
    color: "#111114",
    fontSize: 16,
    fontWeight: "900",
  },
  dropdownValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 6,
  },
  dropdownCarIcon: {
    width: 26,
    height: 18,
    position: "relative",
  },
  dropdownCarBody: {
    position: "absolute",
    left: 2,
    right: 2,
    top: 4,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#E50914",
  },
  dropdownCarWheel: {
    position: "absolute",
    bottom: 1,
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: "#111114",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  dropdownCarWheelLeft: {
    left: 5,
  },
  dropdownCarWheelRight: {
    right: 5,
  },
  dropdownChevron: {
    width: 10,
    height: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#E50914",
    transform: [{ rotate: "45deg" }],
    marginRight: 3,
    marginTop: -5,
  },
  dropdownChevronOpen: {
    transform: [{ rotate: "225deg" }],
    marginTop: 5,
  },
  dropdownMenu: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginTop: 10,
  },
  dropdownItem: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFF2",
  },
  dropdownItemSelected: {
    backgroundColor: "#FFF1F2",
  },
  selectedList: {
    marginTop: 12,
    gap: 10,
  },
  selectedCar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    padding: 10,
  },
  selectedCarImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },
  selectedCarImageEmpty: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#111114",
  },
  carInfo: {
    flex: 1,
  },
  carTitle: {
    color: "#111114",
    fontSize: 16,
    fontWeight: "900",
  },
  carMeta: {
    color: "#686872",
    fontSize: 14,
    marginTop: 4,
  },
  carDescription: {
    color: "#686872",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  checkMark: {
    color: "#E50914",
    fontSize: 13,
    fontWeight: "900",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  field: {
    marginBottom: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    color: "#4B4B54",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DADAE0",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    color: "#111114",
    fontSize: 16,
    paddingHorizontal: 13,
  },
  inputMultiline: {
    minHeight: 94,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  phoneInputWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DADAE0",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  countryButton: {
    alignSelf: "stretch",
    minWidth: 124,
    backgroundColor: "#111114",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  countryFlag: {
    fontSize: 18,
    lineHeight: 22,
  },
  countryCode: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  countryChevron: {
    width: 9,
    height: 9,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#E50914",
    transform: [{ rotate: "45deg" }],
    marginLeft: 2,
    marginTop: -4,
  },
  countryChevronOpen: {
    transform: [{ rotate: "225deg" }],
    marginTop: 4,
  },
  phoneInput: {
    flex: 1,
    minHeight: 48,
    color: "#111114",
    fontSize: 16,
    paddingHorizontal: 13,
  },
  countryMenu: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginTop: 8,
  },
  countryMenuItem: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFF2",
  },
  countryMenuItemActive: {
    backgroundColor: "#FFF1F2",
  },
  countryMenuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  countryMenuFlag: {
    fontSize: 24,
    lineHeight: 28,
  },
  countryMenuName: {
    color: "#111114",
    fontSize: 14,
    fontWeight: "900",
  },
  countryMenuFormat: {
    color: "#6D6D76",
    fontSize: 12,
    marginTop: 3,
  },
  countryMenuCode: {
    color: "#E50914",
    fontSize: 13,
    fontWeight: "900",
  },
  formBlock: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginTop: 12,
  },
  formTitle: {
    color: "#111114",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
  },
  formStatus: {
    color: "#5F5F68",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  blackButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#111114",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 14,
  },
  blackButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  redButton: {
    minHeight: 54,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E50914",
    marginTop: 14,
  },
  redButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  smallRedButton: {
    minHeight: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E50914",
    paddingHorizontal: 12,
  },
  smallRedButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  smallBlackButton: {
    minHeight: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111114",
    paddingHorizontal: 12,
  },
  smallBlackButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  photoButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#111114",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  photoButtonText: {
    color: "#111114",
    fontSize: 15,
    fontWeight: "900",
  },
  newCarPreview: {
    width: 116,
    height: 116,
    borderRadius: 8,
    backgroundColor: "#E4E4E8",
  },
  photoPreviewList: {
    gap: 10,
    paddingBottom: 4,
    marginBottom: 12,
  },
  profileCarCard: {
    borderWidth: 1,
    borderColor: "#E4E4E8",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginBottom: 12,
  },
  profileCarImage: {
    width: "100%",
    height: 170,
  },
  profileCarImageEmpty: {
    width: "100%",
    height: 118,
    backgroundColor: "#111114",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCarImageText: {
    color: "#E50914",
    fontSize: 28,
    fontWeight: "900",
  },
  profileCarBody: {
    padding: 14,
  },
  carGallery: {
    gap: 8,
    paddingTop: 12,
  },
  carGalleryImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#E4E4E8",
  },
  carActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  carActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#111114",
    alignItems: "center",
    justifyContent: "center",
  },
  carActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  carDeleteButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#FFE0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  carDeleteText: {
    color: "#C4000B",
    fontSize: 13,
    fontWeight: "900",
  },
  applicationCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 10,
  },
  applicationTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  applicationTitle: {
    color: "#111114",
    fontSize: 16,
    fontWeight: "900",
  },
  applicationMeta: {
    color: "#686872",
    fontSize: 14,
    marginTop: 10,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    color: "#111114",
    fontSize: 12,
    fontWeight: "900",
  },
  note: {
    color: "#5F5F68",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  tabs: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    height: 64,
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#08080A",
  },
  tabButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: "#E50914",
  },
  tabIcon: {
    color: "#B8B8C0",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  tabIconActive: {
    color: "#FFFFFF",
  },
  tabText: {
    color: "#B8B8C0",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
});
