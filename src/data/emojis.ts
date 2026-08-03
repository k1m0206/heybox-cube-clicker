import emojiManifest from './emojis.json';

export interface CubeEmoji {
  id: string;
  code: string;
  src: string;
  sourceUrl: string;
  type: number;
  keyboardHide: boolean;
}

/**
 * cube 农场表情素材。
 *
 * 图片已经下载到 public/assets/emojis，游戏运行时只使用本地 src。
 */
export const cubeEmojis: CubeEmoji[] = emojiManifest.map((emoji) => ({
  ...emoji,
  src: `${import.meta.env.BASE_URL}${emoji.src.replace(/^\/+/, '')}`,
}));

export const cubeEmojiById = new Map(
  cubeEmojis.map((emoji) => [emoji.id, emoji]),
);
