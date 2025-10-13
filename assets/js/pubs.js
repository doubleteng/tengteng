/* Global Publications dataset (edit-only)
   Fields:
   - type: 'journal' | 'conference' | 'book' | 'thesis' | 'patent' | 'inreview'
   - year: number (YYYY)
   - title: string
   - authors: string (semicolon- or comma-separated; use “Teng, Teng” or “Teng Teng”, both will be bolded on the page)
   - venue: string (journal/proceedings/books/degree etc.)
   - doi: optional 'https://doi.org/...'
   - link: optional url (internal 'research/...', 'design/...' or external 'https://...')
   - note: optional (e.g., 'in press', 'in progress')
   - pdf: optional relative path to a local PDF (e.g., 'assets/papers/xxx.pdf')
*/
window.PUBS = [
  // ===== JOURNAL PAPERS =====
  {
    type:'journal', year:2019,
    title:'Micro-environmental control for efficient local cooling: Results from manikin and human participant tests',
    authors:'Kong, Meng; Zhang, Jianshun; Dang, Thong Q.; Hedge, Alan; Teng, Teng; Carter, Brian; Chianese, Chetna; Khalifa, H. Ezzat',
    venue:'Building and Environment 160:106198',
    doi:'https://doi.org/10.1016/j.buildenv.2019.106198'
  },
  {
    type:'journal', year:2024,
    title:'Designing 3D-printed concrete structures with scaled fabrication models',
    authors:'Zhi, Yefan; Teng, Teng; Akbarzadeh, Masoud',
    venue:'Architectural Intelligence 3(1)',
    doi:'https://doi.org/10.1007/s44223-024-00070-3'
  },
  {
    type:'journal', year:2025,
    title:'Prototyping high-fidelity multifunctional objects using single-nozzle multi-filament additive manufacturing system with active mixing',
    authors:'Teng, Teng; Yefan Zhi; Masoud Akbarzadeh',
    venue:'Materials & Design 249:113479',
    doi:'https://doi.org/10.1016/j.matdes.2024.113479'
  },
  {
    type:'journal', year:2024,
    title:'Automated Toolpath Design of 3D Concrete Printing Structural Components',
    authors:'Zhi, Yefan; Chai, Hua; Teng, Teng; Akbarzadeh, Masoud',
    venue:'Additive Manufacturing',
    doi:'https://doi.org/10.1016/j.addma.2025.104662'
  },
  {
    type:'journal', year:2025,
    title:'Plasticized agarose films: A physiochemical, mechanical and thermal study',
    authors:'Creston A. Singer; Hajara Abdul-Karim; Kyle Printon; Nagireddy Poluri; Teng, Teng; Mostafa Akbari; Behzad Modanloo; Laia Mogas-Soldevila; Masoud Akbarzadeh; Xiao Hu; Sean M. O\'Malley; Hong Fang; David Salas-de la Cruz',
    venue:'International Journal of Biological Macromolecules 141406',
    doi:'https://doi.org/10.1016/j.ijbiomac.2025.141406'
  },
  {
    type:'journal', year:2025,
    title:'3D Concrete Printing of Triply Periodic Minimum Surfaces for Enhanced Carbon Capture and Storage',
    authors:'Yu, Kun-Hao; Teng, Teng; Nah, So Hee; Chai, Hua; Zhi, Yefan; Wang, Kun-Yu; Chi, Yinding; Psarras, Peter; Akbarzadeh, Masoud; Yang, Shu',
    venue:'Advanced Functional Materials 2509259',
    doi:'https://doi.org/10.1002/adfm.202509259'
  },
  {
    type:'journal', year:2024,
    title:'Robosense 3.0: CERA III Adaptive Robotic Clay Printing',
    authors:'Eda Begum Birol; Teng, Teng; Mahshid Moghadashi; Alexia Asgari; Kevin Guo; Karolina Piorko; Veronika Varga; Jenny E. Sabin',
    venue:'3D Printing and Additive Manufacturing',
    note:'in press, 3DP-2024-0150.R1'
  },

  // ===== CONFERENCE PAPERS =====
  {
    type:'conference', year:2024,
    title:'Integrated and Tailored Thermal Insulation through Gradient Multimaterial Additive Manufacturing for Masonry Architectural Components',
    authors:'Teng, Teng; Zhi, Yefan; Akbarzadeh, Masoud',
    venue:'ACADIA 2024 — Designing Change (Banff Centre, Canada, Nov 14–16)'
  },
  {
    type:'conference', year:2024,
    title:'Diamanti: 3D-Printed, Post-tensioned Concrete Canopy',
    authors:'Masoud Akbarzadeh; Hua Chai; Yefan Zhi; Maximilian E. Ororbia; Teng, Teng; Mathias Bernhard; Damon (Mohammad) Bolhassani; Fahimeh Yavartanoo; Javier Tapia; Karolina Pajak; Mylène Bernard; Leon Trousset; Paul Kassabian; Blaise Waligun',
    venue:'FABRICATE 2024: Creating Resourceful Futures',
    doi:'https://doi.org/10.2307/jj.11374766.40'
  },
  {
    type:'conference', year:2023,
    title:'Continuous multi-filament 3D printing for tension-compression structure components',
    authors:'Teng, Teng; Zhi, Yefan; Yu, Kun-Hao; Yang, Shu; Akbarzadeh, Masoud',
    venue:'IASS 2023 Symposium — Integration of Design and Fabrication, Melbourne'
  },
  {
    type:'conference', year:2023,
    title:'Local optimization of self-supporting shell structures in 3D printing: a skeleton method',
    authors:'Zhi, Yefan; Chai, Hua; Teng, Teng; Akbarzadeh, Masoud',
    venue:'IASS 2023 Symposium — Integration of Design and Fabrication, Melbourne'
  },
  {
    type:'conference', year:2021,
    title:'The Design and 4D Printing of Epithelial Cell-inspired Programmable Surface Geometry as Tangible User Interface',
    authors:'Teng, Teng; Sabin, Jenny',
    venue:'eCAADe 2021',
    doi:'https://doi.org/10.52842/conf.ecaade.2021.1.105'
  },
  {
    type:'conference', year:2020,
    title:'Scutoid Brick - The Designing of Epithelial Cell Inspired-brick in Masonry Shell System',
    authors:'Teng, Teng; Jia, Mian; Sabin, Jenny',
    venue:'eCAADe 2020',
    doi:'https://doi.org/10.52842/conf.ecaade.2020.1.563'
  },
  {
    type:'conference', year:2020,
    title:'PICA - A Designer Oriented Low-Cost Personal Robotic Fabrication Platform for Sketch Level Prototyping',
    authors:'Teng, Teng; Sabin, Jenny',
    venue:'CAADRIA 2020',
    doi:'https://doi.org/10.52842/conf.caadria.2020.2.473'
  },
  {
    type:'conference', year:2017,
    title:'Integrated Adaptive and Tangible Architecture Design Tool',
    authors:'Teng, Teng; Li, Qinying',
    venue:'eCAADe 2017',
    doi:'https://doi.org/10.52842/conf.ecaade.2017.1.619'
  },
  {
    type:'conference', year:2015,
    title:'Transformable Physical Design Media',
    authors:'Teng, Teng; Johnson, Brian R.',
    venue:'eCAADe 2015',
    doi:'https://doi.org/10.52842/conf.ecaade.2015.1.045'
  },
  {
    type:'conference', year:2014,
    title:'Inspire: Integrated Spatial Gesture-based Direct 3D Modeling and Display',
    authors:'Teng, Teng; Johnson, Brian R.',
    venue:'ACADIA 2014',
    doi:'https://doi.org/10.52842/conf.acadia.2014.445'
  },

  // ===== BOOK CHAPTER =====
  {
    type:'book', year:2025,
    title:'Funicular Systems with Combined Force',
    authors:'Teng, Teng; Zhi, Yefan; Shao, Yiliang; Ororbia, Maximilian E.',
    venue:'in: Architected Structures (DETAIL Special), ed. Masoud Akbarzadeh. ISBN 978-3-95553-650-3',
    note:'Planned publication date: March 12, 2025'
  },

  // ===== THESES =====
  {
    type:'thesis', year:2025,
    title:'Advanced Additive Manufacturing Across Material, Scale, and Dimensions toward High-Performance Structure',
    authors:'Teng, Teng',
    venue:'PhD Thesis, University of Pennsylvania',
    note:'in progress'
  },
  {
    type:'thesis', year:2021,
    title:'Interactive Fabrication and Design of Bioinspired Surface Geometry',
    authors:'Teng, Teng',
    venue:'Master’s Thesis, Cornell University',
    link:'https://hdl.handle.net/1813/110467'
  },
  {
    type:'thesis', year:2015,
    title:'Transformable Physical Design Media',
    authors:'Teng, Teng',
    venue:'Master’s Thesis, University of Washington',
    link:'http://hdl.handle.net/1773/33440'
  },

  // ===== PATENT =====
  {
  type: 'patent',
  year: 2024,
  title: 'SNMF – An On-the-Fly, Multi-Filament Single-Nozzle for 3D Printing',
  authors: 'Teng, Teng; Zhi, Yefan; Akbarzadeh, Masoud',
  venue: 'Penn Center for Innovation — Technology Publisher. Case ID: 24-10644-TpNCS. Stage: Bench Prototype.',
  link: 'https://upenn.technologypublisher.com/technology/54974',
  note: 'U.S. Provisional Patent Application filed Feb 9, 2024 (App No. 63/551,550). Patent pending.'
}

];
