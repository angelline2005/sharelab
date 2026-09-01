# Contents for the `angelline2005.github.io` repository

These files do **not** belong to this site. They are meant for a *second*,
currently non-existent repository named exactly `angelline2005.github.io`,
which GitHub serves at the root of the subdomain:

```
angelline2005.github.io/          ← that repo   (today: 404)
angelline2005.github.io/sharelab/ ← this repo
```

## Why a second repository is needed at all

Two files only ever work when served from the **root of the host**, and this
site lives one directory down, so neither of them can work today:

| File | Must be at | Today |
|---|---|---|
| `ads.txt` | `angelline2005.github.io/ads.txt` | 404 |
| `robots.txt` | `angelline2005.github.io/robots.txt` | 404 |

The `robots.txt` this site generates lands at `/sharelab/robots.txt`, where no
crawler looks. It is inert until the file below exists.

For `ads.txt`, the rule is less obvious than it looks. Google's normal
instruction is to put it at the root of the domain, which would mean
`github.io/ads.txt` — something you can never control. But `github.io` is on
the [Public Suffix List](https://publicsuffix.org/), and
[AdSense treats such domains as top-level](https://developers.google.com/adsense/platforms/transparent/ads-txt):

> If a domain exists in the Public Suffix List, the location of the ads.txt
> file must be changed. Instead of publishing an ads.txt file on the root of
> the domain (example.com/ads.txt), the ads.txt files have to be posted on each
> subdomain (subdomain.example.com/ads.txt).

So the file Google wants is `angelline2005.github.io/ads.txt` — which is
reachable, but only from a repository named after the subdomain.

## Setting it up

1. Create a public repository named exactly `angelline2005.github.io`.
2. Copy `ads.txt`, `robots.txt` and `index.html` from this folder into its root.
3. **Open `ads.txt` and replace the placeholder publisher ID.** Until you do,
   the file actively tells ad buyers that an account you do not own is
   authorised to sell your inventory, which is worse than having no file.
4. In that repository: Settings → Pages → deploy from branch `main`, folder `/`.
5. Confirm all three respond:
   - `https://angelline2005.github.io/`
   - `https://angelline2005.github.io/ads.txt`
   - `https://angelline2005.github.io/robots.txt`

## The alternative worth considering first

Everything here exists because the blog sits in a subdirectory. Moving it to
the root of `angelline2005.github.io` instead would make `ads.txt` and
`robots.txt` work natively, with no second repository and no redirect page.

That move is now cheap: `BASE` in [`astro.config.mjs`](../astro.config.mjs)
becomes `/`, and nothing else changes — see
[`rehype-base-paths.mjs`](../src/plugins/rehype-base-paths.mjs). The cost is
that a GitHub Pages user site must live in a repository named
`angelline2005.github.io`, so either this project moves there or the deploy
workflow has to publish into it from here.

And if a custom domain is coming anyway, that solves the same problem more
cleanly and this whole folder can be deleted.
