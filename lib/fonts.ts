import { Inter } from 'next/font/google'

/**
 * Запасна гарнітура для Windows та Android — розділ 15 ТЗ.
 *
 * На macOS та iOS шрифт беруть із системи: у стеку першим стоїть SF Pro, і до
 * Inter черга не доходить. Тому `preload: false` — на техніці Apple файл не
 * качається зовсім, а там, де SF Pro немає, браузер візьме його сам.
 *
 * Кирилиця обов'язкова: без неї підставився б Arial, а це в ТЗ прямо названо
 * ознакою дешевого сайту.
 *
 * Один екземпляр на весь сайт: імпортується і uk-, і ru-кореневим layout'ом,
 * щоб не створювати другий шрифтовий підвантажувач.
 */
export const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
})
