export type ContentSource = {
  id: string;
  type: 'attraction' | 'restaurant' | 'hotel' | 'nature' | 'culture' | 'entertainment' | 'transport' | 'service' | 'other' | 'event' | 'post' | 'route' | 'chat';
  location: { latitude: number; longitude: number };
  creatorId: string;
  title: string;
  description: string;
  // ...другие поля
};
