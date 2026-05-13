// Breakdown options config — maps to Meta Ads Insights API parameters

export interface BreakdownOption {
  id: string
  label: string
  description?: string
  /** Query string fragment appended to the insights API URL, e.g. "breakdowns=age" */
  apiParam?: string
}

export interface BreakdownGroup {
  id: string
  label: string
  options: BreakdownOption[]
}

// ─── Popular (shortcuts shown at top of menu) ─────────────────────────────────

export const POPULAR_BREAKDOWNS: BreakdownOption[] = [
  { id: "day",       label: "Day",       apiParam: "time_increment=1"                                   },
  { id: "age",       label: "Age",       apiParam: "breakdowns=age"                                     },
  { id: "placement", label: "Placement", apiParam: "breakdowns=publisher_platform,platform_position"    },
  { id: "country",   label: "Country",   apiParam: "breakdowns=country"                                 },
  { id: "platform",  label: "Platform",  apiParam: "breakdowns=publisher_platform"                      },
]

// ─── Groups with submenus ─────────────────────────────────────────────────────

export const BREAKDOWN_GROUPS: BreakdownGroup[] = [
  {
    id: "time", label: "Time",
    options: [
      { id: "none",   label: "None"    },
      { id: "day",    label: "Day",      apiParam: "time_increment=1"       },
      { id: "week",   label: "Week",     apiParam: "time_increment=7"       },
      { id: "2weeks", label: "2 weeks",  apiParam: "time_increment=14"      },
      { id: "month",  label: "Month",    apiParam: "time_increment=monthly" },
    ],
  },
  {
    id: "demographics", label: "Demographics",
    options: [
      { id: "none",        label: "None"             },
      { id: "age",         label: "Age",              apiParam: "breakdowns=age"                  },
      { id: "gender",      label: "Gender",           apiParam: "breakdowns=gender"               },
      { id: "age_gender",  label: "Age and gender",   apiParam: "breakdowns=age,gender"           },
      { id: "audience_seg",label: "Audience segments",apiParam: "breakdowns=audience_segment_type"},
    ],
  },
  {
    id: "geography", label: "Geography",
    options: [
      { id: "none",    label: "None"       },
      { id: "country", label: "Country",   apiParam: "breakdowns=country" },
      { id: "region",  label: "Region",    apiParam: "breakdowns=region"  },
      { id: "dma",     label: "DMA region",apiParam: "breakdowns=dma"     },
      { id: "city",    label: "City",      apiParam: "breakdowns=city"    },
    ],
  },
  {
    id: "delivery", label: "Delivery",
    options: [
      { id: "none",              label: "None"                                                                                },
      { id: "placement",         label: "Placement",                    apiParam: "breakdowns=publisher_platform,platform_position"               },
      { id: "platform",          label: "Platform",                     apiParam: "breakdowns=publisher_platform"                                  },
      { id: "reels_trending",    label: "Reels trending topic",         apiParam: "breakdowns=skan_conversion_id"                                  },
      { id: "tod_account",       label: "Time of day (ad account time zone)", description: "Available for the last 13 months.", apiParam: "breakdowns=hourly_stats_aggregated_by_advertiser_time_zone" },
      { id: "tod_viewer",        label: "Time of day (viewer's time zone)",   description: "Available for the last 13 months.", apiParam: "breakdowns=hourly_stats_aggregated_by_audience_time_zone"  },
      { id: "impression_device", label: "Impression device",            apiParam: "breakdowns=impression_device"                                   },
      { id: "platform_device",   label: "Platform and device",          apiParam: "breakdowns=publisher_platform,impression_device"                },
      { id: "placement_device",  label: "Placement and device",         apiParam: "breakdowns=publisher_platform,platform_position,impression_device"},
      { id: "media_type",        label: "Media type",                   apiParam: "breakdowns=media_asset_url"                                     },
      { id: "product_id",        label: "Product ID",                   apiParam: "breakdowns=product_id"                                          },
    ],
  },
  {
    id: "action", label: "Action",
    options: [
      { id: "none",              label: "None"                              },
      { id: "msg_purchase",      label: "Messaging purchase source",      apiParam: "breakdowns=messaging_commerce_entry_point" },
      { id: "msg_outcome",       label: "Messaging outcome destination",  apiParam: "breakdowns=destination_type"               },
      { id: "business_ai",       label: "Business AI",                    apiParam: "breakdowns=business_asset_tag"             },
      { id: "conv_device",       label: "Conversion device",              apiParam: "breakdowns=device_platform"                },
      { id: "carousel_card",     label: "Carousel card",                  apiParam: "breakdowns=carousel_card_name"             },
      { id: "destination",       label: "Destination",                    apiParam: "breakdowns=website_ctr"                    },
      { id: "post_reaction",     label: "Post reaction type",             apiParam: "breakdowns=reaction_type"                  },
      { id: "brand",             label: "Brand",                          apiParam: "breakdowns=product_brand"                  },
      { id: "category",          label: "Category",                       apiParam: "breakdowns=product_category"               },
      { id: "video_sound",       label: "Video sound",                    apiParam: "breakdowns=video_sound_status"             },
      { id: "video_view_type",   label: "Video view type",                apiParam: "breakdowns=video_view_type"                },
    ],
  },
  {
    id: "creative", label: "Creative",
    options: [
      { id: "none",            label: "None"            },
      { id: "flexible_format", label: "Flexible format",apiParam: "breakdowns=creative_media_type" },
      { id: "related_media",   label: "Related media",  apiParam: "breakdowns=storytelling_type"   },
    ],
  },
  {
    id: "attribution", label: "Attribution",
    options: [
      { id: "none",                 label: "None"                  },
      { id: "attribution_settings", label: "Attribution settings", apiParam: "breakdowns=attribution_setting"  },
      { id: "conversion_count",     label: "Conversion count",     apiParam: "breakdowns=conversion_timeline" },
    ],
  },
]

// ─── Flat lookup: option id → apiParam ───────────────────────────────────────

export const BREAKDOWN_API_MAP: Record<string, string> = Object.fromEntries(
  [...POPULAR_BREAKDOWNS, ...BREAKDOWN_GROUPS.flatMap(g => g.options)]
    .filter(o => o.apiParam)
    .map(o => [o.id, o.apiParam!])
)

// ─── Flat list for search (deduped, no "none") ────────────────────────────────

const _seen = new Set<string>()
export const ALL_BREAKDOWN_OPTIONS: BreakdownOption[] = [
  ...POPULAR_BREAKDOWNS,
  ...BREAKDOWN_GROUPS.flatMap(g => g.options),
].filter(o => {
  if (o.id === "none" || _seen.has(o.id)) return false
  _seen.add(o.id)
  return true
})
