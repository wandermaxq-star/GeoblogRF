import apiClient from '../api/apiClient';

export interface CreateBookPayload {
  title: string;
  category: string;
  blogIds: string[];
  cover: { image?: string; color?: string; font?: string };
  segments?: Array<{ id: string; paragraphId: string; coordinates: number[][]; highlight: string; title: string }>;
}

export const bookService = {
  async createBook(payload: CreateBookPayload) {
    // Создаем книгу
    const { data: book } = await apiClient.post('/books', {
      title: payload.title,
      description: `Книга, объединяющая ${payload.blogIds.length} блогов`,
      category: payload.category,
      status: 'published'
    });

    // Добавляем блоги в книгу
    for (const blogId of payload.blogIds) {
      try {
        await apiClient.post(`/books/${book.id}/blogs`, { blog_id: blogId });
      } catch (error) {
        console.error(`Ошибка добавления блога ${blogId} в книгу:`, error);
      }
    }

    return book;
  },

  async listMyBooks() {
    try {
      const { data } = await apiClient.get('/books');
      return data;
    } catch (error) {
      return [];
    }
  },

  async initBooksTable() {
    // Инициализируем таблицу книг (только для разработки)
    const { data } = await apiClient.post('/books/init-table');
    return data;
  }
};


