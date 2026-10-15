/* Featured artwork from Openverse. Source and license travel with every image. */
(function () {
  "use strict";
  const BC = globalThis.BC;
  const artwork = [
  {
    "category": "nature",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/2664/3825008839_2f54a6ea15_b.jpg",
      "source": "https://www.flickr.com/photos/90949166@N00/3825008839",
      "title": "New Forest Landscape",
      "creator": "davidgsteadman",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/c06ad4f5-b051-42f1-8277-d5782502a0a0/thumb/"
    }
  },
  {
    "category": "nature",
    "dark": false,
    "image": {
      "url": "https://live.staticflickr.com/508/20505478872_c23f313a8f_b.jpg",
      "source": "https://www.flickr.com/photos/132795455@N08/20505478872",
      "title": "Hazy Forest Landscape",
      "creator": "Image Catalog",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/70fcd115-9f1e-41ab-8309-d06efca4c17d/thumb/"
    }
  },
  {
    "category": "nature",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/65535/51461034500_0430e28a49_b.jpg",
      "source": "https://www.flickr.com/photos/7156765@N05/51461034500",
      "title": "Adirondack Mountains - Whiteface Mountain - Lake Placid - New York -",
      "creator": "Onasill - Bill Badzo - 149 Million Views - Thank Y",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/573b07f3-c0ae-4b7b-9f69-426f28422aa8/thumb/"
    },
    "name": "Mountain Lake 1"
  },
  {
    "category": "nature",
    "dark": false,
    "image": {
      "url": "https://upload.wikimedia.org/wikipedia/commons/4/4c/Turquoise_mountain_lake_%28Unsplash%29.jpg",
      "source": "https://commons.wikimedia.org/w/index.php?curid=61645387",
      "title": "Turquoise mountain lake (Unsplash)",
      "creator": "Volker Schnäbele volker",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.en/",
      "thumbnail": "https://api.openverse.org/v1/images/27cb3614-c990-4158-9a5b-cf7aa5ea5acb/thumb/"
    },
    "name": "Mountain Lake 2"
  },
  {
    "category": "nature",
    "dark": true,
    "image": {
      "url": "https://cdn.stocksnap.io/img-thumbs/960w/9FM2TZZYP4.jpg",
      "source": "https://stocksnap.io/photo/tropical-beach-9FM2TZZYP4",
      "title": "Tropical Beach",
      "creator": "Joe deSousa",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/cdd4a7bf-246f-4122-b514-4d4294d01c25/thumb/"
    },
    "name": "Tropical Shore"
  },
  {
    "category": "nature",
    "dark": false,
    "image": {
      "url": "https://live.staticflickr.com/1633/23959074279_6f899dfe4f_b.jpg",
      "source": "https://www.flickr.com/photos/137643065@N06/23959074279",
      "title": "art-desert-dunes-bw",
      "creator": "pixellaphoto",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/4394e513-678e-41b7-812f-21b4172cebc7/thumb/"
    },
    "name": "Desert Dunes"
  },
  {
    "category": "space",
    "dark": true,
    "image": {
      "url": "https://images.rawpixel.com/image_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L3BkMzYtMi1waWExMDk1NV9vcmlnLmpwZw.jpg",
      "source": "https://www.rawpixel.com/image/441153/the-peony-nebula-star",
      "title": "The Peony nebula star, a blazing",
      "creator": "NASA",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/8d8137ff-e93e-406e-b4df-a26fe97c25dd/thumb/"
    }
  },
  {
    "category": "space",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/7902/33139594198_d16afc3a04_b.jpg",
      "source": "https://www.flickr.com/photos/50769593@N00/33139594198",
      "title": "Mandel-Wilson IFN Volcano-Angel 15 panel version",
      "creator": "kees scherer",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/94c9c913-cd16-40d1-b629-9f94d1af80da/thumb/"
    }
  },
  {
    "category": "space",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/65535/50278276441_3a54f3d082_b.jpg",
      "source": "https://www.flickr.com/photos/158350039@N03/50278276441",
      "title": "backyard astronomy 23",
      "creator": "planes, space, nature",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/a998ddf8-d07e-4000-9a12-36e2af5c90f2/thumb/"
    }
  },
  {
    "category": "space",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/65535/48446786206_0ed5f43428_b.jpg",
      "source": "https://www.flickr.com/photos/158350039@N03/48446786206",
      "title": "backyard astronomy 07",
      "creator": "planes, space, nature",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/7b2ea743-89a8-4e1d-bdcc-738d26cac553/thumb/"
    }
  },
  {
    "category": "space",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/65535/50624916522_157a24bfdf_b.jpg",
      "source": "https://www.flickr.com/photos/158350039@N03/50624916522",
      "title": "backyard astronomy 27",
      "creator": "planes, space, nature",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/86051f57-4937-4753-aecb-d6a1f3358397/thumb/"
    }
  },
  {
    "category": "space",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/111/291708133_37911a8bc3_b.jpg",
      "source": "https://www.flickr.com/photos/39735679@N00/291708133",
      "title": "Released to Public: Neutron Star 2004 by NASA (NASA)",
      "creator": "pingnews.com",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/35321b6f-6ba5-48c9-8230-56c0087ba887/thumb/"
    }
  },
  {
    "category": "city",
    "dark": true,
    "image": {
      "url": "https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg3MzEwNi1pbWFnZS1rd3Z2M3FwdC5qcGc.jpg",
      "source": "https://www.rawpixel.com/image/5906007/photo-image-background-light-public-domain",
      "title": "Free city skyline night image",
      "creator": "",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/2e8c9a55-ebe7-4c7b-948e-5397bf9ec17a/thumb/"
    }
  },
  {
    "category": "city",
    "dark": true,
    "image": {
      "url": "https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvYnMxOTUwLWltYWdlLWt3dng0dG5iLmpwZw.jpg",
      "source": "https://www.rawpixel.com/image/5919276/image-background-aesthetic-design",
      "title": "New York City skyline night",
      "creator": "",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/d41db0f4-7f96-4a5c-bb07-0b62dbae4c94/thumb/"
    }
  },
  {
    "category": "city",
    "dark": true,
    "image": {
      "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA2L3Vwd2s2MTc1Mjc3Mi13aWtpbWVkaWEtaW1hZ2Uta293cWtzNWIuanBn.jpg",
      "source": "https://www.rawpixel.com/image/3302581/free-photo-image-architecture-asphalt-banister",
      "title": "city skyline night seen docks",
      "creator": "",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/c754ce1e-0958-4eef-b2a5-c3b9a6696d76/thumb/"
    }
  },
  {
    "category": "city",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/7501/27838170755_e58cfd7d2d_b.jpg",
      "source": "https://www.flickr.com/photos/111661024@N07/27838170755",
      "title": "Mumbai Skyline Wide",
      "creator": "Vidur Malhotra",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/7a3830c4-b41f-44a3-a4bf-375e022c2abc/thumb/"
    }
  },
  {
    "category": "city",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/8829/18219784390_0e5da73f72_b.jpg",
      "source": "https://www.flickr.com/photos/111661024@N07/18219784390",
      "title": "Mumbai Night City",
      "creator": "Vidur Malhotra",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/23d232f3-3c1b-44c2-a177-242f47d8c4e1/thumb/"
    }
  },
  {
    "category": "city",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/5700/23347480891_364c91ec28_b.jpg",
      "source": "https://www.flickr.com/photos/130478877@N02/23347480891",
      "title": "New York City Skyline from Top of Empire State Building",
      "creator": "jody.claborn",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/1edfe1b0-3d26-44e6-8fd2-6a44db87d8a5/thumb/"
    }
  },
  {
    "category": "art",
    "dark": true,
    "image": {
      "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEwL3BkbWlzYzNiYXRjaDItcGRtaXNjLTg3NDctaW1hZ2UuanBn.jpg",
      "source": "https://www.rawpixel.com/image/7661324/image-art-vintage-public-domain",
      "title": "Hokusai's Wave Kanagawa (1830-1833) vintage",
      "creator": "",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/540fb75e-0078-404a-8a05-08897f44a923/thumb/"
    },
    "name": "Hokusai Wave"
  },
  {
    "category": "art",
    "dark": false,
    "image": {
      "url": "https://live.staticflickr.com/7915/47034104101_71329bcf70_b.jpg",
      "source": "https://www.flickr.com/photos/36417567@N03/47034104101",
      "title": "Wassily Kandinsky (1866–1944), Landscape with Rain, 1913",
      "creator": "Tulip Hysteria / Go to albums",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/966e4f3b-d107-4e03-99e0-4e76a08628c3/thumb/"
    },
    "name": "Kandinsky Painting"
  },
  {
    "category": "art",
    "dark": true,
    "image": {
      "url": "https://live.staticflickr.com/65535/54612842820_802aac84a5_b.jpg",
      "source": "https://www.flickr.com/photos/59275853@N08/54612842820",
      "title": "Regatta at Saint-Adresse by Monet",
      "creator": "kunorojas",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/a62c55c4-b47e-4759-9343-b0a7d4a9ae79/thumb/"
    }
  },
  {
    "category": "art",
    "dark": false,
    "image": {
      "url": "https://live.staticflickr.com/1518/25690234400_ef88ac4377_b.jpg",
      "source": "https://www.flickr.com/photos/92948506@N03/25690234400",
      "title": "Vincent van Gogh, Starry Night Over the Rhone",
      "creator": "Prudence Heward",
      "license": "PDM",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/278dd07a-0b55-416b-b1f5-05798f64cf34/thumb/"
    },
    "name": "Van Gogh Starry Night"
  },
  {
    "category": "art",
    "dark": true,
    "image": {
      "url": "https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcGRtb25ldC1hMzc5MDguanBn.jpg",
      "source": "https://www.rawpixel.com/image/547253/monet-garden-painting",
      "title": "Willows (1880) Claude Monet",
      "creator": "nationalgalleryofart",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/0f802106-6b98-4326-a00e-dcfb50c69fb8/thumb/"
    }
  },
  {
    "category": "art",
    "dark": false,
    "image": {
      "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L3BkZm1hNy1wZGZhbW91c3BhaW50aW5nZXRjMDYxMDAxLWltYWdlXzQuanBn.jpg",
      "source": "https://www.rawpixel.com/image/3896119/illustration-image-background-wallpaper-art",
      "title": "Claude Monet 's Poppy Field",
      "creator": "",
      "license": "CC0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "thumbnail": "https://api.openverse.org/v1/images/7cf9b879-b7b8-4079-bc50-baa5014b25f0/thumb/"
    }
  }
];
  const collections = { nature: "Wild Places", space: "Deep Space", city: "City Lights", art: "Gallery Walls" };
  for (const [category, name] of Object.entries(collections)) {
    BC.PRESET_THEMES.push(BC.themeLibrary.makeTheme(artwork.filter((i) => i.category === category).map((i) => i.image),
      { name, category, dark: category !== "art" }));
  }
  for (const item of artwork) BC.PRESET_THEMES.push(BC.themeLibrary.makeTheme([item.image], item));
})();
