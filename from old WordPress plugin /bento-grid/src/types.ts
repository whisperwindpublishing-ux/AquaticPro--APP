export interface BentoConfig {
  rest_url: string;
  nonce: string;
  posts_per_page: number;
  columns: number;
  selected_categories: number[];
  accent_color: string;
  show_author: boolean;
  show_date: boolean;
  show_tags: boolean;
  layout_type: 'bento' | 'standard';
  grid_title: string;
}

export interface Author {
  name: string;
  avatar: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  count?: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface FeaturedImage {
  url: string;
  alt: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  date: string;
  date_iso: string;
  author: Author;
  categories: Category[];
  tags: Tag[];
  featured_image: FeaturedImage | null;
  permalink: string;
}

export interface PostsResponse {
  posts: Post[];
  total: number;
  pages: number;
}
