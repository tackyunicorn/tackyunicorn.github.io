## Building a zero framework personal blog

Back in 2022, I bought `jjoseph.me` for 10 years from Google Domains. Two years later, I've finally decided to build my _nook_ in the Internet. I could just make a portfolio and call it a day; but I want something more from this blog. I want this to be a place for me to share things I've learned, opinions I've formed, and _hopefully_, in the process, get better at writing.

So, why not start by sharing how I built `jjoseph.me`?

## Goals

My goals with this blog are very simple. I want it to:
1. Run _virtually_ free and for as long as I can
2. Load _blazingly fast_
3. Be super easy to publish to

For goal 1, I've configured `jjoseph.me` as a custom domain on GitHub [Pages](https://github.com/tackyunicorn/tackyunicorn.github.io). Fingers crossed that Microsoft doesn't pull a [Heroku](https://help.heroku.com/RSBRUH58/removal-of-heroku-free-product-plans-faq) on me! 

To make page loads fast, I'm sticking to static site generation and keeping each page under 14kB. Why 14kB? I'd like to quote from `endtimes.dev`:

> What is surprising is that a 14kB page can load much faster than a 15kB page — maybe 612ms faster — while the difference between a 15kB and a 16kB page is trivial. This is because of the TCP slow start algorithm.

Learn more about this [here](https://endtimes.dev/why-your-website-should-be-under-14kb-in-size/)

Finally, to ease publishing, I've decided to keeps things simple and resort to:
- Pandoc + GNU Make
- GitHub Actions
- Obsidian

## Did you just say Make?!

That's right! No fancy Next.js or Hugo templates here. Just a plain `Makefile` that uses [Pandoc](https://pandoc.org/) to transform Markdown into HTML:

```Makefile
all: pages

pages: $(patsubst src/%,pages/%,$(shell find src -type f))

pages/%.md: src/%.md head.html Makefile
	@mkdir -p $(dir $@)
	@sed -E 's|(href="/$(word 2, $(subst /, ,$(dir $<)))")|class="current" \1|' head.html > $(basename $@).html
	pandoc -f gfm -t html $< >> $(basename $@).html

pages/%: src/%
	@mkdir -p $(dir $@)
	@cp $< $@

clean:
	rm -rf pages

watch:
	while true; do find src head.html Makefile | entr -d make; done

serve:
	@trap 'kill -KILL 0' SIGINT; \
	make watch & \
	npx serve pages & \
	wait

.PHONY: all pages clean watch serve
```

Running `make` generates the `pages` directory, which is a copy of `src`, except for the `.md` files. All the `.md` files are converted to HTML by `pandoc` and get prepended with `head.html`, which contains the navigation bar and links to stylesheets and fonts.

Since I'm serving the `pages` directory, I only need to structure `src` with directories for routes I need to create.

So, the following `src` path: `src/posts/post1/index.md`  
would correspond to this route: `jjoseph.me/posts/post1`

Wonder how I highlight the right tab in the navigation at build time? This `sed` snippet in the `Makefile` helps me do that:

```Makefile
@sed -E 's|(href="/$(word 2, $(subst /, ,$(dir $<)))")|class="current" \1|' head.html
```

It looks for the root directory the `.md` file is under, and replaces the corresponding navigation link to have the `current` class added to it. So, if it were processing `src/posts/post1/index.md`, it would add the `current` class to the link with `href="/posts"`

Thanks to this excellent [blog](https://www.karl.berlin/static-site.html) by Karl Bartel, for helping me implement all this!

## Design matters

I'm a sucker for simple and functional design. So, when it came to styling my markdown, I just went for the one everyone is familiar with: GitHub Markdown. Thanks to [`sindresorhus/github-markdown-css`](https://github.com/sindresorhus/github-markdown-css) for helping me replicate this. I also drew inspiration from [bashbunni.dev](https://www.bashbunni.dev/) to recreate a shell prompt on the homepage.

## Publish away!

I can't be bothered to run `make` every time I write a post, so I've configured a GitHub Action to do that on every push: [`deploy.yml`](https://github.com/tackyunicorn/tackyunicorn.github.io/blob/main/.github/workflows/deploy.yml). I've also decided to stick with Obsidian as a Markdown editor, mostly because of its support across desktop and mobile (I'd like to publish from my phone as well). It also has a Git [plugin](https://github.com/Vinzent03/obsidian-git) that will allow me to push directly without needing access to a shell! 

Now, I wonder what I'll write about next...