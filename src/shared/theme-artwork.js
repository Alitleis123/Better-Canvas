/* Photographic collections from Openverse; source and license travel with every image. */
(function () {
  "use strict";
  const BC = globalThis.BC;
  const collections = [
  {
    "name": "Wild Places",
    "category": "nature",
    "images": [
      {
        "url": "https://live.staticflickr.com/508/20505478872_c23f313a8f_b.jpg",
        "source": "https://www.flickr.com/photos/132795455@N08/20505478872",
        "title": "Hazy Forest Landscape",
        "creator": "Image Catalog",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/70fcd115-9f1e-41ab-8309-d06efca4c17d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2664/3825008839_2f54a6ea15_b.jpg",
        "source": "https://www.flickr.com/photos/90949166@N00/3825008839",
        "title": "New Forest Landscape",
        "creator": "davidgsteadman",
        "license": "PDM",
        "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/c06ad4f5-b051-42f1-8277-d5782502a0a0/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/11/12965902_262dad2ce9_b.jpg",
        "source": "https://www.flickr.com/photos/98652633@N00/12965902",
        "title": "Forest landscape III",
        "creator": "tillwe",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/1dcc73e5-f08f-4592-980d-fd7e618b7fac/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2592/4084907519_904712a296_b.jpg",
        "source": "https://www.flickr.com/photos/90949166@N00/4084907519",
        "title": "New Forest Landscape - Leaving Pittswood",
        "creator": "davidgsteadman",
        "license": "PDM",
        "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/5c375642-55f8-4bbf-9ad4-417dd01780f3/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2852/9303753345_0d67cc691b_b.jpg",
        "source": "https://www.flickr.com/photos/98076023@N02/9303753345",
        "title": "Suttons Forest landscape, NSW",
        "creator": "Beyond Coal and Gas",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/a8dc2419-169d-4d37-8a59-53f60d9998e7/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/51631793697_822f331914_b.jpg",
        "source": "https://www.flickr.com/photos/26344495@N05/51631793697",
        "title": "Beautiful marshy forest landscape at sunset",
        "creator": "Ivan Radic",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/a1f20309-1383-4b6c-a0d4-af04b5a74c93/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/305/19914776809_7d1642a47b_b.jpg",
        "source": "https://www.flickr.com/photos/132795455@N08/19914776809",
        "title": "Rain Forest Landscape",
        "creator": "Image Catalog",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/a00294e3-01ad-4fb5-940d-68b2017a1dac/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5756/23873399716_56a13c9d52_b.jpg",
        "source": "https://www.flickr.com/photos/136594255@N06/23873399716",
        "title": "forest landscape",
        "creator": "lisafree54",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/6c276a5d-9fbe-44b9-bfa2-2a28f4a339f6/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5771/22264646872_1cb42850a7_b.jpg",
        "source": "https://www.flickr.com/photos/132795455@N08/22264646872",
        "title": "Snow-Covered Forest Landscape",
        "creator": "Image Catalog",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/ae0dd9dd-116a-4106-906b-d4e0578e8eb3/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8145/7497866432_63bf4c95d4_b.jpg",
        "source": "https://www.flickr.com/photos/37103729@N02/7497866432",
        "title": "LFAWY05 - Fauna monitoring plot, forest landscape, Wyrrabalong National Park",
        "creator": "Doug Beckers",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/58b43011-a9a8-4d2b-89fb-5e36f01728d9/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4039/4441195914_168d3243b8_b.jpg",
        "source": "https://www.flickr.com/photos/40595948@N00/4441195914",
        "title": "Dry Forest Landscape",
        "creator": "A.Davey",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/a83b5c92-bc87-411e-b519-3ae06d3b2504/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5335/9412060676_200be8e6d9_b.jpg",
        "source": "https://www.flickr.com/photos/98652633@N00/9412060676",
        "title": "Black forest landscape, wet",
        "creator": "tillwe",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b0250882-db0a-468d-a8c9-c959e3cb036f/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7346/9401778761_52247f3169_b.jpg",
        "source": "https://www.flickr.com/photos/98652633@N00/9401778761",
        "title": "Black forest landscape I",
        "creator": "tillwe",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/ea9a81cb-7104-4e74-bf0b-0b302faa4b96/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3380/3596187076_b12147fa7e_b.jpg",
        "source": "https://www.flickr.com/photos/34883952@N02/3596187076",
        "title": "New Forest Landscape",
        "creator": "StuartWebster",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/f95a03b7-52d6-40f1-847b-7f360b606f46/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8237/29450222135_1c0945f424_b.jpg",
        "source": "https://www.flickr.com/photos/90802476@N00/29450222135",
        "title": "overlooking forest, landscape",
        "creator": "nicolas.boullosa",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/a9aca6f1-577e-4962-a74a-18b7b578cabc/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2461/3544264335_5b68683cbc_b.jpg",
        "source": "https://www.flickr.com/photos/29507259@N02/3544264335",
        "title": "Aerial view of forest landscape with patchy clouds 1",
        "creator": "D Coetzee",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7d6fff09-efc5-4993-8e63-2e9297a636f1/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3365/3544264779_9fde58e1e4_b.jpg",
        "source": "https://www.flickr.com/photos/29507259@N02/3544264779",
        "title": "Aerial view of forest landscape with patchy clouds 3",
        "creator": "D Coetzee",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b29aa182-23b5-46a9-930f-f21bec139c1f/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3668/9438123620_b27b0d58c6_b.jpg",
        "source": "https://www.flickr.com/photos/99815049@N07/9438123620",
        "title": "Forest landscape",
        "creator": "juanalbertogarciarivera",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b2d20c3b-f60c-4d4f-8599-c02808e0b493/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3602/3544264967_f93accc84a_b.jpg",
        "source": "https://www.flickr.com/photos/29507259@N02/3544264967",
        "title": "Aerial view of forest landscape with patchy clouds 4",
        "creator": "D Coetzee",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7ac0803e-9fe8-4897-9840-e4e3be4fd910/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2449/3545072706_a9f978a763_b.jpg",
        "source": "https://www.flickr.com/photos/29507259@N02/3545072706",
        "title": "Aerial view of forest landscape with patchy clouds 2",
        "creator": "D Coetzee",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/66aed061-f5a7-4577-8f52-b689597df4cd/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2847/33496179583_570e579939_b.jpg",
        "source": "https://www.flickr.com/photos/23807585@N07/33496179583",
        "title": "Forest landscape - Janakkala",
        "creator": "talaakso",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/07c6f81d-d12b-4fec-9ba9-044be46d694e/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7845/47310771652_8ca87c53c9_b.jpg",
        "source": "https://www.flickr.com/photos/39108150@N05/47310771652",
        "title": "Zanard Choice Forest Landscape Architect",
        "creator": "Region 5 Photography",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/d3d4327f-e0c4-4d3d-9eae-db666430ce17/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/947/42016314462_742a85df71_b.jpg",
        "source": "https://www.flickr.com/photos/159657296@N06/42016314462",
        "title": "Ocean and forest landscape",
        "creator": "the-unwinder",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/79f729de-71de-43ae-aa91-04f46c91f9d9/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/53704810304_21936e0c1a_b.jpg",
        "source": "https://www.flickr.com/photos/37174512@N03/53704810304",
        "title": "29480: Sardinian forest landscape around Tattinu",
        "creator": "Panegyrics of Granovetter",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/d0a3eba5-4415-4124-8f16-e27c359c5e2d/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXM3MjAzNS1pbWFnZS5qcGc.jpg",
        "source": "https://www.rawpixel.com/image/9201187/forest-landscape",
        "title": "Forest Landscape",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/47c82920-8f75-411a-892e-41ea8b11ba9c/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2xyL3VtZXN2a3NuZ28zMjI4LWltYWdlLmpwZw.jpg",
        "source": "https://www.rawpixel.com/image/8900910/forest-landscape",
        "title": "Forest landscape, Felicián Moczik",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/2bf4c63a-6155-434b-8be8-03cecda621f6/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2xyL3VtZXN2a3NuZ2cyMTM3LWltYWdlLmpwZw.jpg",
        "source": "https://www.rawpixel.com/image/8899658/forest-landscape",
        "title": "Forest landscape, Aegidius Sadeler Ii",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/6816d547-6db6-4de3-a01a-17c08aa78211/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAxL2xyL3Jpamtzc2stYS0xODI3LWltYWdlLmpwZw.jpg",
        "source": "https://www.rawpixel.com/image/13744815/forest-landscape-the-moonlight-1861-georg-eduard-otto-saal",
        "title": "Forest Landscape Moonlight (1861) Georg",
        "creator": "rijksmuseum",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/983c176d-e191-4129-9586-f6803f32a6f5/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/1452/24352168822_9697f2f5ff_b.jpg",
        "source": "https://www.flickr.com/photos/30939981@N00/24352168822",
        "title": "Maple Leaves in a Misty Forest",
        "creator": "Pai Shih",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/396b2484-5f73-4ae7-a71c-9c8b1c2bd84d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4381/23565854008_4298780b59_b.jpg",
        "source": "https://www.flickr.com/photos/144594988@N02/23565854008",
        "title": "Forza Horizon 3 / Misty Forest",
        "creator": "Stefans02",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/665d4113-23fa-4685-a27d-5549fcb5e68f/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2199/2270473003_1823317f07_b.jpg",
        "source": "https://www.flickr.com/photos/84108876@N00/2270473003",
        "title": "Misty Forest",
        "creator": "Jason Pratt",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/d5672fb0-0249-4245-b2d6-c9ab573fdb87/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/943/41910258782_af0a22d99e_b.jpg",
        "source": "https://www.flickr.com/photos/144594988@N02/41910258782",
        "title": "TheHunter: Call of the Wild / Misty Forest",
        "creator": "Stefans02",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/3ac8ec30-7b9f-475d-b788-06bbfe850b8c/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2464/4060980034_f2b39d1708_b.jpg",
        "source": "https://www.flickr.com/photos/18614695@N00/4060980034",
        "title": "misty forest",
        "creator": "Perrimoon",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/05aea983-b69f-474b-9e71-03755546560e/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/873/27631325777_79ac4eed54_b.jpg",
        "source": "https://www.flickr.com/photos/160596378@N08/27631325777",
        "title": "Misty Forest",
        "creator": "Dmitry Grey",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/905d9c20-bdda-4e84-94cb-7a6c1d595393/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/1779/42263456220_a2d79e5b49_b.jpg",
        "source": "https://www.flickr.com/photos/56196558@N08/42263456220",
        "title": "Misty forest",
        "creator": "jcubic",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/51b04fca-4488-4f23-92ef-1ecbd265bd31/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/50090509606_d0b3f7ebe5_b.jpg",
        "source": "https://www.flickr.com/photos/129605078@N05/50090509606",
        "title": "Misty forest",
        "creator": "Rojs Rozentāls",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/a4cd406c-d62f-4f20-b30b-c72f4574f0f7/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/37/77302691_6a06e9a538_b.jpg",
        "source": "https://www.flickr.com/photos/24174681@N00/77302691",
        "title": "Misty Forest",
        "creator": "cmckendry",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/bdb06a2e-1818-4a9c-abf5-04741ba32a50/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/51685338669_d1c2259144_b.jpg",
        "source": "https://www.flickr.com/photos/80845204@N07/51685338669",
        "title": "~ Misty Forest Morning ~",
        "creator": "Nico Time",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/2c7d1f24-98ab-4aba-877a-95704485080e/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3717/10606183853_52827ffd90_b.jpg",
        "source": "https://www.flickr.com/photos/22539273@N00/10606183853",
        "title": "Misty Forest @ Showa Kinen Park @ Tachikawa",
        "creator": "*_*",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/f7c46b9f-3a59-4ab6-9a8b-e016a20b4bdd/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/51862697700_56dd59fe7a_b.jpg",
        "source": "https://www.flickr.com/photos/67015038@N06/51862697700",
        "title": "Misty Forest Ferns",
        "creator": "ShenandoahNPS",
        "license": "PDM",
        "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/2b41cdf1-0b78-4186-8fe9-28ecb643c814/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7172/6828018601_963e4e82a4_b.jpg",
        "source": "https://www.flickr.com/photos/86548370@N00/6828018601",
        "title": "Misty forest across the Panama Canal",
        "creator": "treegrow",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/f9940bc9-fa31-439a-9e22-cddf4d2c9696/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/602/32059178485_a4d2a8e268_b.jpg",
        "source": "https://www.flickr.com/photos/49734171@N00/32059178485",
        "title": "Misty Forest Track 4",
        "creator": "Mr Moss",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/96bcb490-9d4f-408b-b7f7-e18c275f735d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/52403540922_aff42b01db_b.jpg",
        "source": "https://www.flickr.com/photos/92823399@N07/52403540922",
        "title": "Misty forest of Beaumont-le-Roger",
        "creator": "stanzebla",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/1badd4fb-8a8c-4d1a-8ef7-a4513a7ef955/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7505/16049469041_fd9a72d197_b.jpg",
        "source": "https://www.flickr.com/photos/36521954815@N01/16049469041",
        "title": "misty forest with snow",
        "creator": "BryanAlexander",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/f06b7151-2bd0-4b62-977d-265fec5038e8/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/311/31911212892_674e4fa05b_b.jpg",
        "source": "https://www.flickr.com/photos/49734171@N00/31911212892",
        "title": "Misty Forest Track 3",
        "creator": "Mr Moss",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/0e4fe891-be24-4bd0-8c5e-272a3845fd72/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7355/16283928290_f0a292db7c_b.jpg",
        "source": "https://www.flickr.com/photos/100477236@N02/16283928290",
        "title": "Green and blue",
        "creator": "creyesk",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/3a9b75f7-7072-48b5-8bdc-794df362eb16/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2328/2061718046_64bbbc0a04_b.jpg",
        "source": "https://www.flickr.com/photos/66148700@N00/2061718046",
        "title": "Forest",
        "creator": "RodneyRamsey",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/f53e6b2e-3312-4515-8b2c-cc0c2a979d7b/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5347/6965495286_450efd770a_b.jpg",
        "source": "https://www.flickr.com/photos/41894170049@N01/6965495286",
        "title": "Forest",
        "creator": "andrewmalone",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/c51c6fd6-e86b-4574-8036-077e3f75b5ce/thumb/"
      }
    ]
  },
  {
    "name": "Deep Space",
    "category": "space",
    "images": [
      {
        "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL25hc2EwMDAwOC1pbWFnZV8xLmpwZw.jpg",
        "source": "https://www.rawpixel.com/image/7514102/photo-image-public-domain-galaxy-space",
        "title": "Southern Ring Nebula NASA’s James",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/51f635dc-7f8d-489f-b338-84903d8b742f/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL25hc2EwMDAwNi1pbWFnZS5qcGc.jpg",
        "source": "https://www.rawpixel.com/image/7514068/photo-image-public-domain-galaxy-space",
        "title": "'Cosmic Cliffs' Carina Nebula NASA’s",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b6cd967c-89ca-45cb-b919-600d9bd72124/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL25hc2EwMDAwMS1pbWFnZS5qcGc.jpg",
        "source": "https://www.rawpixel.com/image/7514064/photo-image-public-domain-galaxy-space",
        "title": "“Cosmic Cliffs” Carina Nebula NASA’s",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/83d4d6b2-4101-4725-9734-19790466f9ca/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL25hc2EwMDAwNS1pbWFnZS1sNWoxMGxqbC5qcGc.jpg",
        "source": "https://www.rawpixel.com/image/7514066/photo-image-public-domain-galaxy-space",
        "title": "'Cosmic Cliffs' Carina Nebula NASA’s",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/8407ea94-f654-47ea-ba0a-1e0f922b3304/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7093/27744663791_f140fd684a_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/27744663791",
        "title": "Astronomers Find the First 'Wind Nebula' Around a Rare Ultra-Magnetic Neutron Star",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/056447a6-d359-4d96-975c-c4652789093d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5504/29835637913_db91a6db12_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/29835637913",
        "title": "Hubble Spins a Web Into a Giant Red Spider Nebula",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/6212f927-6455-42c0-8942-80d8e85e20b9/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5647/21866697898_e99c9f0c7a_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/21866697898",
        "title": "Hubble Sees an Aging Star Wave Goodbye",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4f181054-b93a-4339-a89c-728a13d7280e/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7322/8793957087_67191bf306_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/8793957087",
        "title": "Hubble reveals the Ring Nebula’s true shape",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/ae92d8d3-0661-41fd-af4b-a3477632d629/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7236/6945160410_a19c865aec_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/6945160410",
        "title": "Hubble's Panoramic View of a Turbulent Star-Making Region",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/eb1ab381-7b35-4c80-9059-6f5575e3e93d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4142/4774472286_25499d3c4c_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/4774472286",
        "title": "Starburst Cluster Shows Celestial Fireworks",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/09e5cb23-db65-48a0-bb3a-2a6f7e028d84/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/52651768362_7967d8bc81_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/52651768362",
        "title": "Hubble Views a Stellar Duo in Orion Nebula",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/db165fab-9c39-47b9-a41d-7c3796adf9c8/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7359/27993269556_6c37ab4ee6_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/27993269556",
        "title": "Veil Nebula Supernova Remnant",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/43b74cc2-8bf9-4e37-81c0-3577f896a407/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/49086739011_db35372fb1_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/49086739011",
        "title": "Caldwell 11",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4ae28e14-3eb5-4d40-aec8-68a1657b69ab/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/1256/4728043610_f7889a00a8_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/4728043610",
        "title": "Hubble Captures Bubbles And Baby Stars",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/848551e1-370a-463d-83a6-17909d6493b5/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3402/3598601013_c0f30cf63b_b.jpg",
        "source": "https://www.flickr.com/photos/31290768@N06/3598601013",
        "title": "Space - Helix Nebula",
        "creator": "Trodel",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/0a2be07e-474e-40f1-be9a-a6a685309df4/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2794/4253467995_31999793fe_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/4253467995",
        "title": "Suzaku Finds 'Fossil' Fireballs from Supernovae",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4dfd29da-6849-46c1-b41e-1bdf0eeb9701/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2337/2267656276_69b623e93a_b.jpg",
        "source": "https://www.flickr.com/photos/11304375@N07/2267656276",
        "title": "Rho Oph Cloud Star Forming Region",
        "creator": "Image Editor",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/21029bfe-8e64-4133-9ec5-ebe2a65699a1/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/49070783182_9d79fdd9a2_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/49070783182",
        "title": "Caldwell 4",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4ea36813-f36d-42b3-9d35-07d4e7549f2f/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/52378661223_7dff3c041f_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/52378661223",
        "title": "Hubble Unveils an Astronomical Explosion",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/f4e771d2-22bf-4d5c-a007-065f64af47d9/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/50084180361_e6db3fe080_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/50084180361",
        "title": "NGC 7027: The 'Jewel Bug' Nebula",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/fde858db-558b-4eab-b635-edc70962c2fb/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8008/6972394436_74ebe2c1c3_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/6972394436",
        "title": "Hubble Images Searchlight Beams from a Preplanetary Nebula",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/c30829cb-e2f1-4736-8f87-05911c8e9544/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8023/7309213060_d585413262_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/7309213060",
        "title": "NASA's Hubble Shows Milky Way is Destined for Head-On Collision",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/0826098e-9670-42fc-9fd3-3d7ce5a25cc2/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7123/7020703167_2f1a92bd1b_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/7020703167",
        "title": "NASA Launches Five Rockets in Five Minutes",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/c1fbd94d-1771-42ce-9847-3eb911734195/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/52567569450_ce3e813064_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/52567569450",
        "title": "Hubble Views a Star-Studded Cosmic Cloud",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/6fa9ed12-399f-46df-ad9a-a202aaa021d8/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7495/15943518692_910d1a5052_b.jpg",
        "source": "https://www.flickr.com/photos/54209675@N00/15943518692",
        "title": "A WISE Infrared Cone Nebula",
        "creator": "geckzilla",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/8ef1949b-df34-41d8-a5c4-a60861fbe872/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4575/24610628508_bc8de3eb6a_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/24610628508",
        "title": "Planetary Nebula NGC 2818",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/9095fc6b-07a0-4a9e-85c3-7d8d119e3231/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8298/7754604760_6e3b774e1d_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/7754604760",
        "title": "Close Encounter with the Tarantula",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b7cb0ee5-0f1f-4f29-8aca-d140eb34e174/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/51684800623_30b930d9bc_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/51684800623",
        "title": "Herbig-Haro 45 in the Running Man Nebula",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/9118e2d9-ed9e-4e49-90a2-6ff6e1ca293b/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/52328938681_b1c21b899b_b.jpg",
        "source": "https://www.flickr.com/photos/192935202@N08/52328938681",
        "title": "ARP 274 from Hubble",
        "creator": "William Ostling",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/e98852d8-230e-4bff-bd87-fb45bc2a7f99/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/51683743232_a7ac2f0883_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/51683743232",
        "title": "Stellar Jet in the Running Man Nebula",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/a6f010a4-f49e-4d39-902c-1e8ed6215a99/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/52292678410_81b4e3c68d_b.jpg",
        "source": "https://www.flickr.com/photos/192935202@N08/52292678410",
        "title": "NGC 4490 - A galaxy in six bands of light",
        "creator": "William Ostling",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/508a1b2a-2022-4b1a-abff-a8e62ef0117e/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/49211503336_3f192b3604_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/49211503336",
        "title": "Caldwell 63",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7766813a-e819-4040-bc26-fc4ad6afb9d0/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4567/26707998619_b3a1223c4e_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/26707998619",
        "title": "Pencil Nebula",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/58dbf78f-756d-4994-9759-58abd2f66f7a/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4906/31468331457_2b30dda299_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/31468331457",
        "title": "Hubble’s Cosmic Holiday Wreath",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/fdc9bc5a-5adb-4cad-9332-999696157082/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8032/8024062104_572fd07e5a_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/8024062104",
        "title": "Hubble Goes to the eXtreme to Assemble Farthest-Ever View of the Universe",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/216f0245-6fb3-4909-bc9c-a05fef472ac2/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5287/5261815238_502482022f_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/5261815238",
        "title": "Hubble Supernova Bubble Resembles Holiday Ornament",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/699ab131-416e-4c8b-901f-34b792218811/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5485/10998808914_9a21ae776f_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/10998808914",
        "title": "Bright Comet ISON",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/912c799d-bbef-418b-9537-a00928b25e79/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4053/4544909404_906f26c182_b.jpg",
        "source": "https://www.flickr.com/photos/34168865@N08/4544909404",
        "title": "Pillar and Jets HH 901/902",
        "creator": "Hubble Heritage",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7ed964a2-8394-4c9a-b72b-7c3c3201e93b/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5506/10998735616_44d3649754_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/10998735616",
        "title": "Comet ISON Streaks Toward the Sun",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/07eceed6-64cb-4ebc-a3fc-95fb9e08a26d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8201/8250445190_3e84be2d8c_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/8250445190",
        "title": "City Lights of South America’s Atlantic Coast",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4b012743-d9fe-48a4-878f-5ea43da59273/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8374/8531531844_f0e8b6cf0d_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/8531531844",
        "title": "Hubble Nabs Space Invaders?",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/74815330-abc2-449a-90e8-ab1b03e42422/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8575/16216191390_6f4e898a02_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/16216191390",
        "title": "Hubble's View of the Polar Ring of Arp 230",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/a3b16356-c375-44ce-8c15-de7e7c16a4ee/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5061/5613852152_a7d0bcb6d4_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/5613852152",
        "title": "NASA Telescopes Help Discover Surprisingly Young Galaxy",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b54dbe30-818a-49ff-bdd5-eedd9cc8696c/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/518/20149292766_1c35dcc09a_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/20149292766",
        "title": "Hubble Sees a Dying Star's Final Moments",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/0c1d27c3-ac5b-4a71-a797-88314788ea65/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4544/37768879264_fab4ea43c8_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/37768879264",
        "title": "Ant Nebula",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/99a071de-171e-41a1-a7f3-1e826309b514/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/65535/51627621629_cf26fd12c8_b.jpg",
        "source": "https://www.flickr.com/photos/144614754@N02/51627621629",
        "title": "Reflection Nebula IC 2631",
        "creator": "NASA Hubble",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/71da4407-f71e-42ce-ba88-9a9d13611738/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7524/15908352768_8dbaec9df9_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/15908352768",
        "title": "The beautiful side of IC 335",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/2b222ebf-c0c4-4e42-99c6-4ea9ae870b59/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7157/6673661419_192bf69b08_b.jpg",
        "source": "https://www.flickr.com/photos/24662369@N07/6673661419",
        "title": "Hubble Pinpoints Farthest Protocluster of Galaxies Ever Seen",
        "creator": "NASA Goddard Photo and Video",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4a9932ad-2416-4f4d-9ab7-430a07c3cb0f/thumb/"
      }
    ]
  },
  {
    "name": "City Lights",
    "category": "city",
    "images": [
      {
        "url": "https://live.staticflickr.com/1199/5161444480_d7fd7fa44e_b.jpg",
        "source": "https://www.flickr.com/photos/51930963@N02/5161444480",
        "title": "Calgary Downtown City Skyline Night Lights Scene Landscape",
        "creator": "Calgary Reviews",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/713c36fa-ed02-4183-982d-d3de509775db/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/631/23437392492_e1d3a0e0ff_b.jpg",
        "source": "https://www.flickr.com/photos/128863823@N04/23437392492",
        "title": "London city skyline night",
        "creator": "chas679",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/0d35f3f4-15c4-4ac8-90d2-7aa209d7a542/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/722/23279160099_97de559cb8_b.jpg",
        "source": "https://www.flickr.com/photos/128863823@N04/23279160099",
        "title": "London city skyline night",
        "creator": "chas679",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/8d542ad1-a604-47e0-84c9-b73860de836d/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg3MzEwNi1pbWFnZS1rd3Z2M3FwdC5qcGc.jpg",
        "source": "https://www.rawpixel.com/image/5906007/photo-image-background-light-public-domain",
        "title": "Free city skyline night image",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/2e8c9a55-ebe7-4c7b-948e-5397bf9ec17a/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvYnMxOTUwLWltYWdlLWt3dng0dG5iLmpwZw.jpg",
        "source": "https://www.rawpixel.com/image/5919276/image-background-aesthetic-design",
        "title": "New York City skyline night",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/d41db0f4-7f96-4a5c-bb07-0b62dbae4c94/thumb/"
      },
      {
        "url": "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA2L3Vwd2s2MTc1Mjc3Mi13aWtpbWVkaWEtaW1hZ2Uta293cWtzNWIuanBn.jpg",
        "source": "https://www.rawpixel.com/image/3302581/free-photo-image-architecture-asphalt-banister",
        "title": "city skyline night seen docks",
        "creator": "",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/c754ce1e-0958-4eef-b2a5-c3b9a6696d76/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2925/14146388982_8eee0a1dbd_b.jpg",
        "source": "https://www.flickr.com/photos/14913305@N00/14146388982",
        "title": "Philadelphia Night Skyline",
        "creator": "Chris Hunkeler",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/06171094-b6ec-474d-94f7-441d225a3ee9/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7172/6687775229_2c5b9cfe2f_b.jpg",
        "source": "https://www.flickr.com/photos/38478466@N06/6687775229",
        "title": "Downtown Phoenix Skyline at Night",
        "creator": "squeaks2569",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4a277d36-9a0f-4dbb-824b-68ce8df67070/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7500/15882899798_3f44b83a62_b.jpg",
        "source": "https://www.flickr.com/photos/59159233@N04/15882899798",
        "title": "Skyline Singapure",
        "creator": "baranco1",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/6c131577-b86e-4572-901a-704481d60e59/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4511/38142343251_b3fa35deeb_b.jpg",
        "source": "https://www.flickr.com/photos/33634811@N07/38142343251",
        "title": "Amazing Downtown",
        "creator": "_Franck Michel_",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/9ded2bb4-0aa9-4801-a90c-6951d8b18897/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8247/8635775514_2978a24e93_b.jpg",
        "source": "https://www.flickr.com/photos/89846144@N00/8635775514",
        "title": "Brisbane, Queensland, Australia",
        "creator": "wirepic",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7b393110-c973-412f-adc5-ab67e6e4ffc6/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2327/2049159278_e83707c04c_b.jpg",
        "source": "https://www.flickr.com/photos/16434424@N05/2049159278",
        "title": "Atlanta Night Skyline Wallpaper",
        "creator": "james.rintamaki",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/3008b828-9884-41d2-bd48-95c6aed7914f/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2895/14157291402_9a168b9075_b.jpg",
        "source": "https://www.flickr.com/photos/27656017@N02/14157291402",
        "title": "Downtown Seattle",
        "creator": "tdlucas5000",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/386d0cc6-7de1-46ec-90af-ffcb49ab796e/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/6196/6095265588_ef3bec0ca7_b.jpg",
        "source": "https://www.flickr.com/photos/58621196@N05/6095265588",
        "title": "night in Pittsburgh",
        "creator": "brdonovan",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/5ec4df43-1f2d-49ef-9ec9-64c42919cef6/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8586/28750907625_2352b6697b_b.jpg",
        "source": "https://www.flickr.com/photos/66885349@N03/28750907625",
        "title": "City skyline",
        "creator": "Gael Varoquaux",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/64c53848-2bfc-44c3-b84c-d8b2f3e5fd26/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/1122/1356493609_d61a65a399_b.jpg",
        "source": "https://www.flickr.com/photos/12900105@N03/1356493609",
        "title": "New York City by Night Skyline",
        "creator": "Timo Kohlenberg",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/6bfdf321-93c9-490e-a9d1-656d6e7932d3/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7023/6662245419_29b608da9c_b.jpg",
        "source": "https://www.flickr.com/photos/73014677@N05/6662245419",
        "title": "Sin City",
        "creator": "Fraser Mummery",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7f66c1f4-a61c-4ec4-84b2-b7924edcb366/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2318/1594828030_ace94cf930_b.jpg",
        "source": "https://www.flickr.com/photos/63504485@N00/1594828030",
        "title": "Skyline Boston",
        "creator": "ReneS",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/f1f8d49b-eed9-41d1-abf9-70facc1185d4/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/58/191766759_af5f8173ec_b.jpg",
        "source": "https://www.flickr.com/photos/15411972@N00/191766759",
        "title": "Singapore Skyline",
        "creator": "Jo@net",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/69343d32-ea11-48f1-8266-5e3bc55a66d5/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7114/7553959762_2f71bf9c4a_b.jpg",
        "source": "https://www.flickr.com/photos/50203533@N00/7553959762",
        "title": "Austin City Lights",
        "creator": "StuSeeger",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/182ded5a-7c4a-4ae1-b2d3-6a4c52f2022a/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2402/2360672546_9896a526e0_b.jpg",
        "source": "https://www.flickr.com/photos/98185064@N00/2360672546",
        "title": "Seattle Skyline",
        "creator": "bryce_edwards",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/deba5fe8-39ba-442e-8358-451334693e17/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2020/2658290939_7b17f486e1_b.jpg",
        "source": "https://www.flickr.com/photos/23860276@N05/2658290939",
        "title": "Dallas Skyline",
        "creator": "Schlüsselbein2007",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/2ff043c6-6e26-44dd-8c92-008440871ebf/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/77/215752879_99083dd186_b.jpg",
        "source": "https://www.flickr.com/photos/40467171@N00/215752879",
        "title": "Colorful Hong Kong Island",
        "creator": "laszlo-photo",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/da93f7cb-c407-4d89-a20e-7c330d4b1ca4/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8086/8553010494_17448cf48b_b.jpg",
        "source": "https://www.flickr.com/photos/29057345@N04/8553010494",
        "title": "City Lights",
        "creator": "It's No Game",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/932db7e9-dd43-4e83-a891-710ad31c649a/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/305/31793632472_53f8759000_b.jpg",
        "source": "https://www.flickr.com/photos/66885349@N03/31793632472",
        "title": "Dusk on 'La Défense' —Paris",
        "creator": "Gael Varoquaux",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/94c3d11d-2d6b-44e4-b38f-610f0b63faec/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/1295/4675155661_1d58ed70f9_b.jpg",
        "source": "https://www.flickr.com/photos/45713725@N00/4675155661",
        "title": "A night view of the Bellagio and Las Vegas from above",
        "creator": "o palsson",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/79fd0f76-c6f5-4ada-8620-0a2a02538e5c/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3626/3599402248_fbdc61a6d7_b.jpg",
        "source": "https://www.flickr.com/photos/31290768@N06/3599402248",
        "title": "Skyline - New York City, New York at night",
        "creator": "Trodel",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/56581993-b180-4f0c-9f3a-8365aec62d14/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3397/3636726236_348631f4e5_b.jpg",
        "source": "https://www.flickr.com/photos/26809429@N02/3636726236",
        "title": "Nightline skyline",
        "creator": "rutlo",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4f2980d8-e9e2-4863-87ae-c882926ec723/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3295/3066046680_0c9d4eef79_b.jpg",
        "source": "https://www.flickr.com/photos/23766028@N00/3066046680",
        "title": "Hong Kong Skyline",
        "creator": "das farbamt",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/fcc7443e-1054-45b7-935e-da85648f88d9/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2839/9636312625_6efaa2263f_b.jpg",
        "source": "https://www.flickr.com/photos/61533954@N00/9636312625",
        "title": "Midtown skyline looking east, NYC",
        "creator": "Dimitry B",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/25ef1a37-5b3b-4c12-bae2-cdfe74c7580b/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8618/28220770594_dfff1c81fb_b.jpg",
        "source": "https://www.flickr.com/photos/66885349@N03/28220770594",
        "title": "San Francisco from Bernal Heights",
        "creator": "Gael Varoquaux",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/be594648-05f2-4d07-8fbf-4b20ee079438/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3002/2872269982_c642601993_b.jpg",
        "source": "https://www.flickr.com/photos/23000860@N06/2872269982",
        "title": "Los Angeles Skyline Dodger Stadium Sept 19 2008",
        "creator": "jondoeforty1",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/e444e3a5-431b-40c6-837b-8a13d3efc272/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2261/2484855417_6f58539661_b.jpg",
        "source": "https://www.flickr.com/photos/15185049@N02/2484855417",
        "title": "Bogota cityscape 3",
        "creator": "lornapips",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/d6bf5b9e-0d15-4c8a-baaa-b32ce591c9bd/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4119/4768676199_690ea26d5f_b.jpg",
        "source": "https://www.flickr.com/photos/51867225@N08/4768676199",
        "title": "Chicago Skyline @ Night",
        "creator": "Rhys A.",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4b8eaa5a-7206-4b24-bb6d-b4600c42a26d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/11/13436939_c2f0153b77_b.jpg",
        "source": "https://www.flickr.com/photos/72926532@N00/13436939",
        "title": "Denver Nightscape",
        "creator": "dagpeak",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7664f6d3-45d6-42b8-bb7e-a393be1e852d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/1496/25957447976_b7955b0be3_b.jpg",
        "source": "https://www.flickr.com/photos/51942038@N04/25957447976",
        "title": "Hong Kong Skyline at Night - Star Ferry",
        "creator": "Wilson Hui",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/10ca29f5-22eb-4d58-b43c-9275be2e1881/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4084/5087135517_8e33d72bb5_b.jpg",
        "source": "https://www.flickr.com/photos/15411972@N00/5087135517",
        "title": "Skyline at night",
        "creator": "Jo@net",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/56583677-38d0-4da6-bd78-a455071ae590/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2457/3598488389_64a17a8e11_b.jpg",
        "source": "https://www.flickr.com/photos/31290768@N06/3598488389",
        "title": "Skyline - Hong Kong, China",
        "creator": "Trodel",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/df7813c9-3fe9-4ca2-a0c6-370c3f5b5c47/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/37/95984916_bfb457436f_b.jpg",
        "source": "https://www.flickr.com/photos/91161616@N00/95984916",
        "title": "London Night Time Shots",
        "creator": "Man & His Cam",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/95e38a71-ee30-4463-839e-c066ae2eeebf/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4099/4738570807_ebfbf6ee95_b.jpg",
        "source": "https://www.flickr.com/photos/40495680@N00/4738570807",
        "title": "Manhattan",
        "creator": "sakeeb",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7c6f5b98-d3ba-4724-a351-61a8d90dab6a/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3478/3181200934_6e3b154104_b.jpg",
        "source": "https://www.flickr.com/photos/81464596@N00/3181200934",
        "title": "Charlotte Skyline",
        "creator": "James Willamor",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b2d47c2f-26cb-4d8d-924a-9580768956dc/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7292/8739644375_78cf4831c1_b.jpg",
        "source": "https://www.flickr.com/photos/32593403@N00/8739644375",
        "title": "Bay Bridge at night",
        "creator": "gpoo",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/35bd30fc-7b87-45cf-bc56-a75974fc0dea/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4757/27963436109_4916defc0c_b.jpg",
        "source": "https://www.flickr.com/photos/33634811@N07/27963436109",
        "title": "Over the top",
        "creator": "_Franck Michel_",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/2082a1bf-d28b-4c43-aff9-3d9e5baaaf6c/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2147/2081153623_d37fdad539_b.jpg",
        "source": "https://www.flickr.com/photos/9531520@N05/2081153623",
        "title": "Columbus, OH Skyline",
        "creator": "jpmueller99",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b202d5f5-e7bd-43fd-89fe-c789a974f19b/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2463/3598596311_84211f2566_b.jpg",
        "source": "https://www.flickr.com/photos/31290768@N06/3598596311",
        "title": "Skyline - Paris, France at night",
        "creator": "Trodel",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4db8948d-2881-4e2b-8f3b-e8c3abef9262/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7633/17185995745_1d85c56bc6_b.jpg",
        "source": "https://www.flickr.com/photos/90975693@N05/17185995745",
        "title": "the galaxy",
        "creator": "tommy@chau",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/433d237d-6d80-4180-8d78-2cf7d2940baf/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5348/17230657949_593594c2af_b.jpg",
        "source": "https://www.flickr.com/photos/31085717@N00/17230657949",
        "title": "LG G4 cameraphone test shot #lgg4",
        "creator": "kyeniz",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/be94ecbe-124b-44da-840e-7acea4d6868d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7607/17005493549_e451f1eaf4_b.jpg",
        "source": "https://www.flickr.com/photos/56218409@N03/17005493549",
        "title": "Berlin, Berlin",
        "creator": "mripp",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/5438640e-83e1-4759-8691-1f87086fd651/thumb/"
      }
    ]
  },
  {
    "name": "Gallery Walls",
    "category": "art",
    "images": [
      {
        "url": "https://live.staticflickr.com/4817/46785469801_72746d6010_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/46785469801",
        "title": "Monet landscape painting wall art",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b3f4ef61-3e22-4918-a3d8-2579fd6dd07a/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4864/44548692220_3836c476d1_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/44548692220",
        "title": "Monet landscape painting wall art",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/37ec78f0-fc21-4051-ab12-7adf4b0c6952/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4855/46314563162_250dfc9f69_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/46314563162",
        "title": "Monet landscape painting of Seine",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/d6382952-4fad-4cfe-bd72-c039e49a327e/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4863/46785468841_fa0fe24441_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/46785468841",
        "title": "Monet landscape painting wall art",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/96775c6a-f081-4652-8ad8-09a700ebd5b1/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4840/32493636438_e050c608c5_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/32493636438",
        "title": "Monet landscape painting of a cliff",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/c0d7857f-73fe-4c29-8f73-d2bef4dff4a4/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4842/45870354475_8d9144d0d8_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/45870354475",
        "title": "Monet landscape painting wall art",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/6e41ec29-3242-4674-a172-fd96b865455f/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4890/46732749112_9ea2109306_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/46732749112",
        "title": "Monet landscape painting wall art",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/e706643b-d93b-46af-9aad-6a786965737f/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7809/39819972153_c4cd00207b_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/39819972153",
        "title": "Monet landscape painting",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/fab95ac7-d423-480b-aa42-a9654a05df04/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7872/45870354995_6a1258dd3b_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/45870354995",
        "title": "Monet landscape painting wall art",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/092e52c8-e18b-4ddc-8928-1629184c87d2/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7869/39819980313_871693e89a_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/39819980313",
        "title": "Monet landscape painting of a cliff",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/1949bf92-17e4-4868-8f4e-ae726392793d/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4904/31843649437_fa0d2be2d0_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/31843649437",
        "title": "Monet landscape painting wall art",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/9edd328a-fcbe-48e5-ba4e-2d12b790b27e/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7076/7281110564_2b5394cd09_b.jpg",
        "source": "https://www.flickr.com/photos/28752865@N08/7281110564",
        "title": "RHS Chelsea Flower Show 2012",
        "creator": "Karen Roe",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/0c7e2ecc-11b8-4317-b311-8db6cc0d4403/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7094/7281105610_a7c86f26d3_b.jpg",
        "source": "https://www.flickr.com/photos/28752865@N08/7281105610",
        "title": "RHS Chelsea Flower Show 2012",
        "creator": "Karen Roe",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/e3a3cb55-3f26-4950-ac8c-e07ed3376fda/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7441/10538965076_3a9379898e_b.jpg",
        "source": "https://www.flickr.com/photos/104736837@N03/10538965076",
        "title": "2007.09 - 'Seascape with a view on the two needle cliffs in the bay of Etretat', in Normandy France with a quiet sea; French landscape photography, Fons Heijnsb",
        "creator": "Amsterdam free photos & pictures of the Dutch city",
        "license": "PDM",
        "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
        "thumbnail": "https://api.openverse.org/v1/images/5e244616-4b58-4ccf-8514-42e1a539421c/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/37/80286929_da785f33a0_b.jpg",
        "source": "https://www.flickr.com/photos/66653812@N00/80286929",
        "title": "Water-Lilies, Claude Monet",
        "creator": "oliworx",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/ea70adf3-971f-46e4-aefb-dc2b5ace9c0c/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7072/7281112548_ac184c5dcf_b.jpg",
        "source": "https://www.flickr.com/photos/28752865@N08/7281112548",
        "title": "RHS Chelsea Flower Show 2012",
        "creator": "Karen Roe",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/53c57cc4-9c99-4cf9-a108-6d5d95ee2aae/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7229/7281107326_dabe052484_b.jpg",
        "source": "https://www.flickr.com/photos/28752865@N08/7281107326",
        "title": "RHS Chelsea Flower Show 2012",
        "creator": "Karen Roe",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4e230d64-6638-49da-8e57-07a03b68f126/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2742/4435959199_b96ac33aab_b.jpg",
        "source": "https://www.flickr.com/photos/92269745@N00/4435959199",
        "title": "Water Lilies, Reflections of Weeping Willows",
        "creator": "ralph and jenny",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/fd27248d-6669-426c-a448-bcf33a517bb8/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2358/2331021863_4e7e5f2d14_b.jpg",
        "source": "https://www.flickr.com/photos/20172348@N00/2331021863",
        "title": "Painting by Millet, Inside d'Orsay Museum, Paris, France",
        "creator": "Bogdan Migulski",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b5856ca2-72b8-4649-a9ac-6ce12110b4f5/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8153/7281096792_2a56919238_b.jpg",
        "source": "https://www.flickr.com/photos/28752865@N08/7281096792",
        "title": "RHS Chelsea Flower Show 2012",
        "creator": "Karen Roe",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/aa392a09-a575-4ab1-a5fb-3aa32c863eab/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2538/4116327119_77f6f795f9_b.jpg",
        "source": "https://www.flickr.com/photos/69275268@N00/4116327119",
        "title": "claude monet - la tamise à charing cross",
        "creator": "Xuan Che",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/53bd85d5-52a2-48ba-b89d-e381fa38a45c/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3302/3669584772_6280f5d915_b.jpg",
        "source": "https://www.flickr.com/photos/9987501@N08/3669584772",
        "title": "mastering the arts / panneau décoratif, odilon redon",
        "creator": "andrevanb",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/0c74e53b-2323-49d6-867c-f17ef518ef88/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/48/150241736_f72948856b_b.jpg",
        "source": "https://www.flickr.com/photos/47489771@N00/150241736",
        "title": "Courtyard of Belvedere",
        "creator": "miss karen",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/57ce3d2d-2739-41b1-846e-782bcb4ade1f/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3457/3752709881_cc2cbddb4e_b.jpg",
        "source": "https://www.flickr.com/photos/39415781@N06/3752709881",
        "title": "Musee d'Orsay and the Palais de la Légion d'honneur / Musée des Anciens combattants - River Seine",
        "creator": "ell brown",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/0a6013c4-4b04-460d-8368-7255d615dd77/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2664/3920578381_e75c215973_b.jpg",
        "source": "https://www.flickr.com/photos/26270547@N07/3920578381",
        "title": "LandscapeTheParcMonceau_TheMET (2)",
        "creator": "rverc",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/23000fa2-8b8f-49c5-a4f5-82df8152c28c/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3443/3920581015_3b4cafe4a2_b.jpg",
        "source": "https://www.flickr.com/photos/26270547@N07/3920581015",
        "title": "LandscapeTheParcMonceau_TheMET (4)",
        "creator": "rverc",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/9d598508-2fc1-46e5-acaf-3d3fa48fbd69/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5518/14375075358_1603cde2c8_b.jpg",
        "source": "https://www.flickr.com/photos/51207680@N04/14375075358",
        "title": "Impression, sunset",
        "creator": "European Southern Observatory",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/93d2d9d0-981d-4df2-8eaa-078357470c96/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3182/3283249288_4cb1979ea4_b.jpg",
        "source": "https://www.flickr.com/photos/28577026@N02/3283249288",
        "title": "2009-02-15 München 160 Neue Pinakothek, Claude Monet - Seerosen",
        "creator": "Allie_Caulfield",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/04350a25-dfe6-4814-9d99-e89ff45494fe/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2444/3743931718_51e297330d_b.jpg",
        "source": "https://www.flickr.com/photos/39415781@N06/3743931718",
        "title": "Monet's Garden - Water Lillies and Pond",
        "creator": "ell brown",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/938459f4-bdee-42ed-a86b-78dc1347af73/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/73/224528150_6e889229d4_b.jpg",
        "source": "https://www.flickr.com/photos/85428086@N00/224528150",
        "title": "Louvre, Monet-Nuferii",
        "creator": "gigi4791",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/51ca1ebd-32ce-47eb-8dda-ab123020c357/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4844/32493636948_b4e4556ae5_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/32493636948",
        "title": "Monet Water Lilies and footbridge painting",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/05b85b1a-217c-451a-bad5-cdbd0a0436bb/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3259/2838003875_ec13bab415_b.jpg",
        "source": "https://www.flickr.com/photos/75683070@N00/2838003875",
        "title": "Claude Monet, National Gallery of Art, West Building, Washington, D.C.",
        "creator": "Ken Lund",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7c41f941-d420-4827-b396-1861d0768685/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4918/31843651917_40b4839aef_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/31843651917",
        "title": "Monet ship painting",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/435a03be-6174-4dba-b496-3f79e610ea56/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/8391/8479247103_e9fd619a99_b.jpg",
        "source": "https://www.flickr.com/photos/22083482@N03/8479247103",
        "title": "Haystack at Giverny",
        "creator": "George M. Groutas",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/4a4be2e0-4bad-4ef8-87af-6dad6756a933/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/2685/4385860895_d1c006876f_b.jpg",
        "source": "https://www.flickr.com/photos/94722257@N00/4385860895",
        "title": "Monet detail",
        "creator": "Hard Seat Sleeper",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/0b24d872-7042-4719-a5d9-fa776ba97025/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/5244/5309492194_31967ec34c_b.jpg",
        "source": "https://www.flickr.com/photos/35854555@N04/5309492194",
        "title": "Monet - un bras de Seine près de Vétheuil",
        "creator": "Eusebius@Commons",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/595f44f3-e14a-4de8-896c-a42622678e86/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3428/3390525677_9d9b6a9a23_b.jpg",
        "source": "https://www.flickr.com/photos/26270547@N07/3390525677",
        "title": "TheFourTrees_TheMET",
        "creator": "rverc",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/42f4a53d-d8dc-4a7d-9947-26148ff8bd25/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4895/31843644887_65ef9dab7b_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/31843644887",
        "title": "Monet Water Lilies and bridge painting",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/ef570cbf-a6f0-4a53-8a20-52af6e6cbccc/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/6177/6198701189_670d992ba8_b.jpg",
        "source": "https://www.flickr.com/photos/26270547@N07/6198701189",
        "title": "TheRoadfromVersaillestoLouveciennes_TheMET(5)",
        "creator": "rverc",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/2c30ea63-59e9-4838-8624-76d2613ac608/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4137/4761630374_cbc46f6cce_b.jpg",
        "source": "https://www.flickr.com/photos/26270547@N07/4761630374",
        "title": "TheBodmerOak_TheMET (8)",
        "creator": "rverc",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/b474e868-7457-451e-9e64-3800116ecfc8/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/4917/31843644227_9130a9359e_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/31843644227",
        "title": "Monet bridge painting",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/dd0f65ba-7d64-4721-bff8-c4b0a392bc71/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7892/32909650898_e407717f95_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/32909650898",
        "title": "Monet house painting",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/68bdf106-4539-4dcd-84e5-9fdf7cf8851c/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3138/2838004583_7fc24b0e90_b.jpg",
        "source": "https://www.flickr.com/photos/75683070@N00/2838004583",
        "title": "Claude Monet, National Gallery of Art, West Building, Washington, D.C.",
        "creator": "Ken Lund",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/28c8eda5-2297-41fb-9f84-e87275b1aa20/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/3037/2838004479_ea8fd4b885_b.jpg",
        "source": "https://www.flickr.com/photos/75683070@N00/2838004479",
        "title": "Claude Monet, National Gallery of Art, West Building, Washington, D.C.",
        "creator": "Ken Lund",
        "license": "BY-SA",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/2dac0bbc-1628-48a1-b1d7-acf78d150a50/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7815/39819971583_1161519f0c_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/39819971583",
        "title": "Monet summer painting",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/783d2c8a-efea-4912-843a-4d99c3313e11/thumb/"
      },
      {
        "url": "https://live.staticflickr.com/7822/46732746782_9cff9aca7c_b.jpg",
        "source": "https://www.flickr.com/photos/153584064@N07/46732746782",
        "title": "Monet boats painting",
        "creator": "Free Public Domain Illustrations by rawpixel",
        "license": "BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "thumbnail": "https://api.openverse.org/v1/images/7ebcaadc-4bfb-42ef-ad6b-4301e9e16d8c/thumb/"
      }
    ]
  }
];
  for (const pack of collections) {
    const theme = BC.themeLibrary.makeTheme(pack.images, { name: pack.name, category: pack.category, dark: pack.category !== "art" });
    theme.id = "photos-" + pack.category;
    theme.description = pack.images.length + " different photographs and artworks · coordinated full-page look";
    BC.PRESET_THEMES.push(theme);
  }
})();
