/* Global project dataset (use across the whole site)
   - url: path relative to the SITE ROOT (e.g. "research/…/"), no leading "/"
   - cats: primary categories (one or more): "research" | "design" | "teaching"
   - tags: secondary tags: "computation","material","fabrication","robotics",
           "architecture","product","interface","research","teaching","design"
*/
window.PROJECTS = [
  // ===== Research =====
  {title:"SNMM Additive Manufacturing System", url:"research/snmm-additive-manufacturing-system/", cats:["research"], year:2025, img:"https://images.unsplash.com/photo-1581093588401-16a6b8c24355?q=80&w=1200&auto=format&fit=crop", tags:["fabrication","material","research"]},
  {title:"3D Printing Biomineral-Infused Concrete for Enhanced Carbon Capture", url:"research/biomineral-infused-concrete-carbon-capture/", cats:["research"], year:2025, img:"https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop", tags:["fabrication","material","research"]},
  {title:"Integrated & Tailored Thermal Insulation", url:"research/integrated-and-tailored-thermal-insulation/", cats:["research"], year:2024, img:"https://images.unsplash.com/photo-1565608318817-007ebce3d284?q=80&w=1200&auto=format&fit=crop", tags:["computation","fabrication","research"]},
  {title:"Scaled Fabrication Models", url:"research/scaled-fabrication-models/", cats:["research"], year:2024, img:"https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?q=80&w=1200&auto=format&fit=crop", tags:["fabrication","research"]},
  {title:"Diamanti: 3D-Printed Post-Tensioned Canopy", url:"research/diamanti-post-tensioned-concrete-canopy/", cats:["research"], year:2024, img:"https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=1200&auto=format&fit=crop", tags:["fabrication","robotics","research"]},
  {title:"MM 3D Printing for Tension–Compression", url:"research/multi-material-3d-printing-tension-compression/", cats:["research"], year:2023, img:"https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1200&auto=format&fit=crop", tags:["computation","fabrication","research"]},
  {title:"Epithelial Cell-Inspired Programmable Surface Geometry", url:"research/epithelial-programmable-surface-geometry/", cats:["research"], year:2021, img:"https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1200&auto=format&fit=crop", tags:["computation","fabrication","research"]},
  {title:"Scutoid Brick", url:"research/scutoid-brick/", cats:["research"], year:2020, img:"https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?q=80&w=1200&auto=format&fit=crop", tags:["computation","research"]},
  {title:"Pinbed", url:"research/pinbed/", cats:["research"], year:2020, img:"https://images.unsplash.com/photo-1518310383802-640c2de311b2?q=80&w=1200&auto=format&fit=crop", tags:["fabrication","robotics","research"]},
  {title:"Pica", url:"research/pica/", cats:["research","design"], year:2019, img:"https://images.unsplash.com/photo-1545235617-9465d2a55698?q=80&w=1200&auto=format&fit=crop", tags:["fabrication","robotics","product","design","research"]},

  // ===== Design =====
  {title:"Programmable Footwear", url:"design/programmable-footwear/", cats:["design","research"], year:2025, img:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop", tags:["product","research","design"]},
  {title:"W. Newton St Rowhouse", url:"design/w-newton-st-rowhouse/", cats:["design"], year:2021, img:"https://images.unsplash.com/photo-1536376072261-38c75010e6c9?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"OPERATION PPE", url:"design/operation-ppe/", cats:["design"], year:2020, img:"https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&auto=format&fit=crop", tags:["product","design"]},
  {title:"Tang Courtyard Promenade", url:"design/tang-courtyard-promenade/", cats:["design"], year:2018, img:"https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"Shanghai Museum – Phase II", url:"design/shanghai-museum-phase2/", cats:["design"], year:2016, img:"https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"FANA Mixed-use Complex Development", url:"design/fana-mixed-use-complex/", cats:["design"], year:2016, img:"https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"Transformable Physical Design Media", url:"design/transformable-physical-design-media/", cats:["design","research"], year:2015, img:"https://images.unsplash.com/photo-1545235617-9465d2a55698?q=80&w=1200&auto=format&fit=crop", tags:["interface","research","design"]},
  {title:"INSPIRE", url:"design/inspire/", cats:["design","research"], year:2014, img:"https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop", tags:["interface","research","design"]},
  {title:"WFJ Waterfront Development", url:"design/wfj-waterfront-development/", cats:["design"], year:2014, img:"https://images.unsplash.com/photo-1460353581641-37baddab0fa2?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"Dragon Light International Shopping Mall", url:"design/dragon-light-international-mall/", cats:["design"], year:2014, img:"https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"Waterfront Seattle", url:"design/waterfront-seattle/", cats:["design"], year:2013, img:"https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"Instant City · Plug-in Architecture", url:"design/instant-city-plug-in-architecture/", cats:["design"], year:2012, img:"https://images.unsplash.com/photo-1581092921461-eab62e97a266?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"CRLL Chongqing MIXC", url:"design/crll-chongqing-mixc/", cats:["design"], year:2011, img:"https://images.unsplash.com/photo-1476357471311-43c0db9fb2b4?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"Jinji Lake Land", url:"design/jinji-lake-land/", cats:["design"], year:2011, img:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"Kaisa Center (Mixed-Use)", url:"design/kaisa-center-mixed-use/", cats:["design"], year:2011, img:"https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"Yintai Centre (Mixed-Use)", url:"design/yintai-centre-mixed-use/", cats:["design"], year:2010, img:"https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},
  {title:"RIBO Central Club", url:"design/ribo-central-club/", cats:["design"], year:2010, img:"https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop", tags:["architecture","design"]},

  // ===== Teaching =====
  {title:"Building Robots for Robotic Fabrication", url:"teaching/building-robots-for-robotic-fabrication/", cats:["teaching","research"], year:2024, img:"https://images.unsplash.com/photo-1536305030436-22563cbc76f0?q=80&w=1200&auto=format&fit=crop", tags:["robotics","research","teaching"]},
  {title:"AI Empowered Creative Robotics Workshop", url:"teaching/ai-empowered-creative-robotics-workshop/", cats:["teaching"], year:2023, img:"https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop", tags:["robotics","teaching"]},
  {title:"New Material & Method", url:"teaching/new-material-and-method/", cats:["teaching","research"], year:2023, img:"https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1200&auto=format&fit=crop", tags:["material","research","teaching"]},
  {title:"Undergraduate Architecture Thesis", url:"teaching/undergraduate-architecture-thesis/", cats:["teaching"], year:2021, img:"https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1200&auto=format&fit=crop", tags:["architecture","teaching"]},
  {title:"Undergraduate Product Design Thesis", url:"teaching/undergraduate-product-design-thesis/", cats:["teaching"], year:2021, img:"https://images.unsplash.com/photo-1516542076529-1ea3854896e1?q=80&w=1200&auto=format&fit=crop", tags:["product","teaching"]},
  {title:"Digital Fabrication", url:"teaching/digital-fabrication/", cats:["teaching"], year:2016, img:"https://images.unsplash.com/photo-1581091215367-59ab6b94f1b2?q=80&w=1200&auto=format&fit=crop", tags:["fabrication","architecture","product","teaching"]}
];
