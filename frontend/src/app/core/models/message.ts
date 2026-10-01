export interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}
