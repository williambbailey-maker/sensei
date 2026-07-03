# Testing M0 connectivity from a self-hosted (residential-IP) runner

The M0 gate came back **BLOCKED** on GitHub's hosted runners: Cloudflare returns
`403 "Just a moment..."` for both `requests` and Playwright because `ubuntu-latest`
runs on datacenter IP ranges that Dutchie's bot protection blocks.

A **self-hosted runner on a residential IP** (your home machine, a home-network
mini-PC, etc.) is the "different runner" path. Register one, then dispatch the
existing `m0-connectivity.yml` against it to prove whether that IP gets through.

## 1. Register the runner (one-time, on the home machine)

Repo → **Settings → Actions → Runners → New self-hosted runner**. Pick the OS,
then run the commands GitHub shows you. They look like:

```bash
mkdir actions-runner && cd actions-runner
curl -o actions-runner.tar.gz -L <url-github-gives-you>
tar xzf actions-runner.tar.gz
./config.sh --url https://github.com/williambbailey-maker/sensei --token <token-github-gives-you>
./run.sh          # keeps the runner online; use ./svc.sh to install as a service
```

By default the runner gets the label **`self-hosted`** (plus OS/arch labels). You
can add a custom label during `config.sh` if you prefer.

**Requirements on that machine:** Python 3.12 available, and `sudo` access so
`playwright install --with-deps chromium` can apt-install browser libraries. On a
Linux box that's automatic; on macOS the `--with-deps` step is a no-op and Chromium
still installs fine.

> Security note: a self-hosted runner executes whatever the workflow contains.
> This repo is yours and the workflow is small, but keep the runner on a machine
> you control and remove it when M0 is settled.

## 2. Run the gate against it

Actions → **M0 Connectivity Test** → **Run workflow** → set **Runner to test from**
to `self-hosted` (or your custom label) → Run.

The job summary reports the same `METHOD_THAT_WORKED = requests | playwright | BLOCKED`
and dumps the first 2KB of HTML.

## 3. Interpreting the result

- **requests works** → best case; the daily pipeline can run on this self-hosted
  runner cheaply. (Note: the machine must be online at the scheduled cron time.)
- **only playwright works** → also fine, jobs are a bit slower.
- **still BLOCKED** → the residential IP alone isn't enough; fall back to the
  rotating-residential-proxy option from the spec.

## 4. Cleanup

When done testing, remove the runner: **Settings → Actions → Runners → … → Remove**,
and run `./config.sh remove --token <token>` on the machine.
