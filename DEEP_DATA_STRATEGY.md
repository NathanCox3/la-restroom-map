# Deep Restroom Coverage Strategy

The goal is maximum coverage without misleading users who urgently need a reliable bathroom. The database separates confirmed restroom records from possible restroom hosts.

## Source Classes

- Confirmed public restroom points: LA City Port restroom dataset, OpenStreetMap `amenity=toilets`, Metro restroom maps, Long Beach and city/county restroom layers when stable endpoints are available.
- Strong possible hosts: libraries, civic buildings, transit stations, community centers, parks, museums, malls, large retail, visitor venues, beaches, marinas, hospitals, universities, and recreation centers.
- Customer-access possible hosts: restaurants, fast food, cafes, bars, pubs, gas stations, supermarkets, department stores, hotels, and convenience stores.
- Reports and leads: local news, agency press releases, community guides, Reddit threads, and accessibility/restroom advocacy projects should become review tasks, not automatic verified records.

## Current Deep Import

`npm run import:deep` adds an OpenStreetMap candidate-host pass across the LA coastal/core bounding box. Candidate records are labeled `Possible`, given low confidence, and include notes that access is unverified.

The deep import intentionally skips OSM records tagged `toilets=no` and does not merge a possible host into a confirmed restroom unless the location and name are nearly identical.

## Verification Protocol

- Verify exact entrance/location, whether a restroom exists, public/customer/restricted access, hours, ADA access, gender-neutral availability, fee/key/code/purchase requirement, and last checked date.
- Field checks should record evidence type: staff confirmation, posted sign, direct observation, agency dataset, or user report.
- Recheck high-value public records every 90 days and low-confidence candidate records before promoting them to confirmed.
- Never promote a restaurant, gas station, or shop to confirmed based only on business category.

## Practical Limits

“Every square foot” cannot be guaranteed from public data alone. Restaurants and private businesses change policies often, and many do not publish restroom access. The MVP should therefore keep a broad candidate layer, a verified layer, and a review workflow so coverage can improve without overclaiming reliability.
