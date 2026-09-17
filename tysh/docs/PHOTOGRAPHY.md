# Choosing the photography

Every product photograph is an Unsplash photo id, picked from a pool per department and
category. To make a category look exactly the way you want (for example the dreamy,
romantic dresses or the elevated designer tees you have in mind), give it your own pool.

## 1. Find photos you like on Unsplash

Search unsplash.com for the mood, e.g. `tulle dress editorial`, `silk gown`, `organza dress
fashion`, `oversized white t-shirt editorial`, `heavyweight tee studio`. Open a photo and
copy the id from the address bar or the image URL:

```
https://unsplash.com/photos/woman-in-white-dress-1509631179647-0177331693ae
                                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^
https://images.unsplash.com/photo-1509631179647-0177331693ae?…
                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

The id is `photo-1509631179647-0177331693ae`. Portrait photographs of a single garment on a
model, against a plain or soft background, work best; the storefront crops to 3:4.

## 2. Assign them to a category

Edit `src/data/image-overrides.json`:

```json
{
  "pools": {
    "women.dresses": ["photo-…", "photo-…", "photo-…", "photo-…"],
    "women.tops":    ["photo-…", "photo-…", "photo-…"],
    "men.tops":      ["photo-…", "photo-…"]
  }
}
```

Keys are `department.category` (see `src/data/taxonomy.ts` for the category slugs). Give
each pool at least as many photos as the category has colour variants across its products
(a dozen is comfortable), because each colour of each product gets its own photograph and a
product never repeats one.

## 3. Rebuild the catalogue and check

```bash
npm run catalog          # regenerates src/data/products.json with your photos
npm run images:verify    # every id resolves
npm run images:audit     # tags match the department and category
npm run dev
```

Pinterest images cannot be used directly: they are not licensed for reuse and most are
copyrighted editorial shots. Unsplash photographs are free to use under the Unsplash License.

## The homepage hero

The hero photograph lives in `src/data/hero.json`: change `id` to any Unsplash photo id,
adjust `focal` (CSS object-position, e.g. `50% 30%`) to control the crop, and edit the
eyebrow and headline lines there too. No rebuild of the catalogue is needed.
