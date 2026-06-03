export const API_BASE_URL = "https://major-motors-sam.uz/api";
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export type Festival = {
  id: number;
  title: string;
  description: string;
  city: string;
  address: string;
  start_date: string;
  end_date?: string | null;
  prize_fund: string | null;
  prize_places: number | null;
  car_slots: number | null;
  status: "draft" | "open" | "closed" | "finished";
  cover_image?: string;
  cover_slides: FestivalCoverSlide[];
  media_items: FestivalMedia[];
  winners: FestivalWinner[];
  comments: FestivalComment[];
  applications_count: number;
};

export type FestivalCoverSlide = {
  id: number;
  image: string;
  title: string;
  order: number;
  created_at: string;
};

export type FestivalMedia = {
  id: number;
  media_type: "image" | "video";
  file: string;
  title: string;
  description: string;
  order: number;
  created_at: string;
};

export type FestivalWinner = {
  id: number;
  place: number;
  title: string;
  participant_name: string;
  car_name: string;
  description: string;
  image?: string;
  is_published: boolean;
  created_at: string;
};

export type FestivalComment = {
  id: number;
  festival: number;
  participant: number;
  participant_name: string;
  participant_photo?: string;
  text: string;
  created_at: string;
};

export type AppSettings = {
  id: number;
  title: string;
  logo?: string;
  updated_at: string;
};

export type Profile = {
  id: number;
  full_name: string;
  phone: string;
  photo?: string;
  telegram: string;
  city: string;
  cars: ProfileCar[];
};

export type AuthPayload = {
  full_name?: string;
  phone: string;
  password: string;
  password_confirm?: string;
};

export type ProfileCar = {
  id: number;
  owner: number;
  make: string;
  model: string;
  year: number;
  engine: string;
  condition: string;
  tuning_details: string;
  main_photo?: string;
  photos: ProfileCarPhoto[];
};

export type ProfileCarPhoto = {
  id: number;
  image: string;
  created_at: string;
};

export function mediaUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${SERVER_BASE_URL}${url}`;
}

export type Application = {
  id: number;
  festival: number;
  participant: number;
  cars_detail: ProfileCar[];
  participant_name: string;
  phone: string;
  status: "new" | "reviewing" | "approved" | "rejected";
  moderator_note: string;
  created_at: string;
};

export async function fetchFestivals(): Promise<Festival[]> {
  const response = await fetch(`${API_BASE_URL}/festivals/`);
  if (!response.ok) {
    throw new Error("Не удалось загрузить фестивали");
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload.results;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const response = await fetch(`${API_BASE_URL}/app-settings/`);
  if (!response.ok) {
    throw new Error("Не удалось загрузить настройки приложения");
  }
  return response.json();
}

export async function saveProfile(payload: Omit<Profile, "id" | "cars">): Promise<Profile> {
  const response = await fetch(`${API_BASE_URL}/profiles/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Не удалось сохранить профиль");
  }
  return response.json();
}

export async function registerProfile(payload: AuthPayload): Promise<Profile> {
  const response = await fetch(`${API_BASE_URL}/auth/register/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function loginProfile(payload: AuthPayload): Promise<Profile> {
  const response = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function fetchProfile(profileId: number): Promise<Profile> {
  const response = await fetch(`${API_BASE_URL}/profiles/${profileId}/`);
  if (!response.ok) {
    throw new Error("Не удалось загрузить профиль");
  }
  return response.json();
}

export async function updateProfile(profileId: number, payload: Pick<Profile, "full_name" | "telegram" | "city"> | FormData): Promise<Profile> {
  const isFormData = payload instanceof FormData;
  const response = await fetch(`${API_BASE_URL}/profiles/${profileId}/`, {
    method: "PATCH",
    headers: isFormData ? undefined : {
      "Content-Type": "application/json",
    },
    body: isFormData ? payload : JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function createFestivalComment(payload: Pick<FestivalComment, "festival" | "participant" | "text">): Promise<FestivalComment> {
  const response = await fetch(`${API_BASE_URL}/comments/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function deleteFestivalComment(commentId: number, profileId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/comments/${commentId}/?participant=${profileId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function updateCar(carId: number, payload: FormData): Promise<ProfileCar> {
  const response = await fetch(`${API_BASE_URL}/cars/${carId}/`, {
    method: "PATCH",
    body: payload,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function deleteCar(carId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/cars/${carId}/`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function fetchApplications(profileId: number): Promise<Application[]> {
  const response = await fetch(`${API_BASE_URL}/applications/?participant=${profileId}`);
  if (!response.ok) {
    throw new Error("Не удалось загрузить заявки");
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload.results;
}
