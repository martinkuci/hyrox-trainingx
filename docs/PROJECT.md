# HYROX Training — projekt

## Cíl

Mobilně orientovaná webová aplikace pro plánování HYROX tréninků, práci s tréninkovými programy, přesouvání jednotek v kalendáři a ukládání výsledků.

## Uživatel a hlavní scénáře

- sportovec si vytvoří nebo importuje trénink,
- sestaví program a vloží jej do kalendáře,
- spustí trénink s časovačem a mezičasy,
- po dokončení uloží výsledek,
- nahraje screenshot z hodinek nebo fitness aplikace, nechá z něj předvyplnit údaje a před uložením je zkontroluje,
- volitelně synchronizuje data přes Firebase.

## Aktuální architektura

- Next.js App Router, React, TypeScript a Tailwind CSS,
- klientská data v `localStorage`,
- volitelná synchronizace přes Firebase Authentication a Firestore REST API,
- nasazení z GitHubu na Vercel,
- mobilní rozhraní v češtině.

## Hranice první verze

První verze musí nabídnout použitelný tok od naplánování tréninku po uložení výsledku. Screenshot se používá pouze jako dočasný vstup pro rozpoznání; aplikace ukládá až uživatelem potvrzené strukturované hodnoty, nikoli samotný obrázek.

## Důležité zásady

- API klíče nesmí být v klientském kódu ani v repozitáři.
- Každý automaticky rozpoznaný údaj musí být před uložením editovatelný.
- Aplikace musí zůstat použitelná na telefonu.
- Stávající lokální data musí zůstat zpětně kompatibilní.
