type SeedFoodType = "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN";
type SeedStation = "HOT" | "TANDOOR" | "COLD" | "BAR";
type SeedRow = readonly [name: string, description: string, basePricePaise: number, foodType: SeedFoodType, station: SeedStation, preparationMinutes: number, featured?: boolean];

type SeedItem = {
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  basePricePaise: number;
  foodType: SeedFoodType;
  station: SeedStation;
  preparationMinutes: number;
  featured: boolean;
  variants: [];
  modifierGroups: [];
};

const expandCategory = (category: string, imageUrl: string, rows: readonly SeedRow[]): SeedItem[] => rows.map(([name, description, basePricePaise, foodType, station, preparationMinutes, featured = false]) => ({ name, category, description, imageUrl, basePricePaise, foodType, station, preparationMinutes, featured, variants: [], modifierGroups: [] }));

export const expandedCatalogue = (pexels: (id: string) => string): SeedItem[] => [
  ...expandCategory("Small Plates", pexels("21078315"), [
    ["Crispy Corn Kebab", "Corn kernels, smoked paprika, lime and coriander.", 26500, "VEGETARIAN", "HOT", 9],
    ["Beetroot Galouti", "Silken beetroot patties, saffron yogurt and toasted seed crunch.", 30500, "VEGETARIAN", "HOT", 11],
    ["Methi Malai Momo", "Steamed vegetable dumplings in a fenugreek cream sauce.", 29500, "VEGETARIAN", "HOT", 12],
    ["Chicken 65 Bites", "Curry leaf fried chicken, yoghurt and green chilli.", 39500, "NON_VEGETARIAN", "HOT", 13, true],
    ["Prawn Koliwada", "Ajwain-spiced prawns, lime and a crisp rice-flour crust.", 46500, "NON_VEGETARIAN", "HOT", 14],
    ["Kathal Seekh", "Charred young-jackfruit seekh with pickled onion.", 31500, "VEGAN", "TANDOOR", 14]
  ]),
  ...expandCategory("From the Fire", pexels("33430556"), [
    ["Achari Paneer Skewers", "Pickled-spice paneer, peppers and charred lemon.", 40500, "VEGETARIAN", "TANDOOR", 14],
    ["Tandoori Chicken Leg", "Yogurt-marinated chicken, smoked paprika and mint.", 52500, "NON_VEGETARIAN", "TANDOOR", 18, true],
    ["Ajwaini Fish Tikka", "Ajwain, mustard and lime-marinated seasonal fish.", 49500, "NON_VEGETARIAN", "TANDOOR", 16],
    ["Bharwan Mushroom", "Stuffed button mushrooms, toasted cheese and herbs.", 35500, "VEGETARIAN", "TANDOOR", 13],
    ["Hariyali Chicken", "Coriander, mint and green chilli chicken tikka.", 45500, "NON_VEGETARIAN", "TANDOOR", 16],
    ["Lasooni Broccoli", "Garlic-marinated broccoli, sesame and lemon.", 33500, "VEGAN", "TANDOOR", 12],
    ["Lamb Chapli Kebab", "Minced lamb, pomegranate seed and warming spice.", 53500, "NON_VEGETARIAN", "TANDOOR", 18]
  ]),
  ...expandCategory("Mains", pexels("36009039"), [
    ["Kadai Paneer", "Paneer, roasted pepper, tomato and crushed coriander.", 38500, "VEGETARIAN", "HOT", 16],
    ["Kashmiri Rogan Josh", "Slow-braised lamb with fennel, ginger and Kashmiri chilli.", 56500, "NON_VEGETARIAN", "HOT", 22, true],
    ["Goan Fish Curry", "Market fish, coconut, kokum and curry leaf.", 52500, "NON_VEGETARIAN", "HOT", 18],
    ["Mushroom Pepper Fry", "Forest mushrooms, black pepper and curry leaf.", 36500, "VEGAN", "HOT", 15]
  ]),
  ...expandCategory("Rice & Breads", pexels("20446413"), [
    ["Garlic Naan", "Clay-oven naan brushed with roasted garlic butter.", 9500, "VEGETARIAN", "TANDOOR", 5],
    ["Butter Naan", "Soft tandoor naan finished with cultured butter.", 8500, "VEGETARIAN", "TANDOOR", 5],
    ["Roomali Roti", "Paper-thin handkerchief bread made to order.", 7500, "VEGAN", "TANDOOR", 6],
    ["Ghee Podi Idli", "Steamed idli, gunpowder and warm ghee.", 18500, "VEGETARIAN", "HOT", 8],
    ["Vegetable Pulao", "Basmati rice, garden vegetables and whole spices.", 22500, "VEGAN", "HOT", 12],
    ["Mutton Biryani", "Dum-cooked basmati, tender mutton and fried onion.", 59500, "NON_VEGETARIAN", "HOT", 24, true]
  ]),
  ...expandCategory("Coolers", pexels("17200460"), [
    ["Salted Mango Fizz", "Raw mango, black salt, mint and sparkling water.", 18500, "VEGAN", "BAR", 4],
    ["Jaljeera Cooler", "Cumin, tamarind, mint and chilled soda.", 14500, "VEGAN", "BAR", 3],
    ["Nannari Soda", "Sarsaparilla root syrup, lemon and soda.", 15500, "VEGAN", "BAR", 3],
    ["Iced Masala Chai", "Slow-brewed chai, milk and warming spice.", 15500, "VEGETARIAN", "BAR", 4],
    ["Watermelon Basil Cooler", "Watermelon, sweet basil and lime.", 19500, "VEGAN", "BAR", 4],
    ["Tender Coconut Mint", "Tender coconut water, mint and a squeeze of lime.", 17500, "VEGAN", "BAR", 3]
  ]),
  ...expandCategory("Sweet Finish", pexels("7449105"), [
    ["Kesariya Phirni", "Saffron rice custard, pistachio and rose.", 20500, "VEGETARIAN", "COLD", 5],
    ["Mishti Doi", "Baked Bengali yogurt with jaggery caramel.", 19500, "VEGETARIAN", "COLD", 4],
    ["Pista Rabri", "Reduced milk, pistachio and cardamom.", 22500, "VEGETARIAN", "COLD", 5],
    ["Baked Rasgulla", "Warm cottage-cheese dumplings in saffron milk.", 23500, "VEGETARIAN", "COLD", 7],
    ["Mango Shrikhand", "Saffron yogurt, Alphonso mango and almond.", 21500, "VEGETARIAN", "COLD", 4],
    ["Jaggery Payasam", "Coconut milk, rice flakes and palm jaggery.", 20500, "VEGAN", "COLD", 5],
    ["Saffron Cheesecake", "Baked saffron cheesecake with pistachio praline.", 28500, "VEGETARIAN", "COLD", 6, true]
  ]),
  ...expandCategory("Soups & Chaats", pexels("21078315"), [
    ["Tomato Dhaniya Shorba", "Roasted tomato, coriander and pepper broth.", 16500, "VEGAN", "HOT", 8],
    ["Sweet Corn Rasam", "Corn, tamarind, black pepper and curry leaf.", 17500, "VEGAN", "HOT", 9],
    ["Mulligatawny Soup", "Lentil soup, apple, coconut and gentle spice.", 19500, "VEGETARIAN", "HOT", 10],
    ["Papdi Chaat", "Crisp papdi, potato, yogurt, tamarind and mint.", 18500, "VEGETARIAN", "COLD", 8],
    ["Raj Kachori", "A large crisp shell with sprouts, yogurt and chutneys.", 22500, "VEGETARIAN", "COLD", 10],
    ["Dahi Puri", "Six crisp puris, spiced potato and sweet yogurt.", 19500, "VEGETARIAN", "COLD", 8],
    ["Kale Chana Chaat", "Black chickpea, pomegranate, onion and lime.", 20500, "VEGAN", "COLD", 8],
    ["Chicken Yakhni Soup", "Clear chicken broth, herbs and cracked pepper.", 24500, "NON_VEGETARIAN", "HOT", 12],
    ["Prawn Rasam", "Tamarind, tomato, prawns and pepper.", 28500, "NON_VEGETARIAN", "HOT", 12],
    ["Samosa Chaat", "Crisp samosa, chickpea curry, yogurt and chutneys.", 21500, "VEGETARIAN", "HOT", 10]
  ]),
  ...expandCategory("Coastal Kitchen", pexels("14731625"), [
    ["Kerala Fish Moilee", "Delicate fish in coconut milk, ginger and curry leaf.", 54500, "NON_VEGETARIAN", "HOT", 19],
    ["Chettinad Chicken", "Peppery chicken curry with stone-ground spices.", 48500, "NON_VEGETARIAN", "HOT", 20],
    ["Allepey Prawn Roast", "Roasted prawns, coconut, chilli and curry leaf.", 56500, "NON_VEGETARIAN", "HOT", 18, true],
    ["Mangalorean Ghee Roast Paneer", "Paneer in a fiery coastal chilli paste.", 40500, "VEGETARIAN", "HOT", 16],
    ["Konkani Sol Kadhi", "Kokum, coconut milk and fresh coriander.", 14500, "VEGAN", "COLD", 4],
    ["Meen Pollichathu", "Banana-leaf fish, coconut and tangy masala.", 58500, "NON_VEGETARIAN", "HOT", 23],
    ["Goan Vegetable Xacuti", "Vegetables in toasted coconut and poppy seed gravy.", 36500, "VEGAN", "HOT", 16],
    ["Neer Dosa", "Soft rice crepes with a delicate fermented finish.", 12500, "VEGAN", "HOT", 6],
    ["Appam Basket", "Three lacy Kerala appams made fresh to order.", 14500, "VEGAN", "HOT", 8],
    ["Kori Rotti", "Mangalorean chicken curry with crisp rice wafers.", 49500, "NON_VEGETARIAN", "HOT", 19]
  ]),
  ...expandCategory("Regional Classics", pexels("28675074"), [
    ["Dal Baati Churma", "Baked wheat baati, panchmel dal and jaggery crumble.", 34500, "VEGETARIAN", "HOT", 18],
    ["Sarson Saag Makki Roti", "Mustard greens, white butter and maize flatbread.", 36500, "VEGETARIAN", "HOT", 18],
    ["Bengali Cholar Dal", "Bengal gram, coconut and whole spices.", 28500, "VEGETARIAN", "HOT", 14],
    ["Kashmiri Dum Aloo", "Baby potatoes in fennel, ginger and yogurt gravy.", 34500, "VEGETARIAN", "HOT", 16],
    ["Laal Maas", "Rajasthani lamb curry with Mathania chilli.", 59500, "NON_VEGETARIAN", "HOT", 24, true],
    ["Bihari Litti Chokha", "Roasted sattu dumplings, tomato and potato mash.", 29500, "VEGAN", "HOT", 15],
    ["Naga Pork Curry", "Slow-cooked pork, bamboo shoot and Naga chilli.", 57500, "NON_VEGETARIAN", "HOT", 25],
    ["Awadhi Veg Korma", "Seasonal vegetables, cashew and aromatic spices.", 38500, "VEGETARIAN", "HOT", 17],
    ["Hyderabadi Bagara Baingan", "Baby aubergine, sesame, peanut and tamarind.", 35500, "VEGAN", "HOT", 17],
    ["Lucknowi Chicken Korma", "Slow-cooked chicken in a delicate cashew gravy.", 50500, "NON_VEGETARIAN", "HOT", 21]
  ]),
  ...expandCategory("Street Favourites", pexels("21078315"), [
    ["Vada Pav Sliders", "Spiced potato fritters, garlic chutney and soft pav.", 19500, "VEGETARIAN", "HOT", 9],
    ["Pav Bhaji", "Butter-toasted pav with slow-cooked vegetable bhaji.", 24500, "VEGETARIAN", "HOT", 12],
    ["Mumbai Tawa Pulao", "Spiced rice, vegetable bhaji and a squeeze of lime.", 25500, "VEGAN", "HOT", 13],
    ["Kolkata Kathi Roll", "Flaky paratha, paneer, onion and green chutney.", 28500, "VEGETARIAN", "HOT", 12],
    ["Chicken Kathi Roll", "Flaky paratha, charred chicken and pickled onion.", 34500, "NON_VEGETARIAN", "HOT", 13],
    ["Aloo Tikki Chaat", "Crisp potato cakes, chickpeas, yogurt and chutney.", 20500, "VEGETARIAN", "HOT", 10],
    ["Keema Pav", "Slow-cooked minced lamb, toasted pav and lime.", 36500, "NON_VEGETARIAN", "HOT", 15],
    ["Masala Fries", "Crisp potatoes, chaat masala and curry-leaf salt.", 17500, "VEGAN", "HOT", 8],
    ["Paneer Frankie", "Spiced paneer, cabbage and a warm whole-wheat wrap.", 27500, "VEGETARIAN", "HOT", 11],
    ["Egg Keema Bun", "Masala egg scramble in a toasted soft bun.", 23500, "NON_VEGETARIAN", "HOT", 10]
  ]),
  ...expandCategory("Bowls & Light Meals", pexels("28674705"), [
    ["Quinoa Khichdi Bowl", "Quinoa, moong dal, vegetables and lemon pickle.", 32500, "VEGAN", "HOT", 14],
    ["Paneer Burrata Bowl", "Grilled paneer, greens, tomato and basil yogurt.", 36500, "VEGETARIAN", "COLD", 12],
    ["Tandoori Chicken Grain Bowl", "Charred chicken, millet, greens and mint dressing.", 42500, "NON_VEGETARIAN", "HOT", 16],
    ["Avocado Millet Salad", "Millet, avocado, cucumber, herbs and lime.", 34500, "VEGAN", "COLD", 10],
    ["Rajma Rice Bowl", "Slow-cooked kidney beans, basmati and onion salad.", 28500, "VEGAN", "HOT", 13],
    ["Tofu Pepper Bowl", "Pepper tofu, vegetables and sesame rice.", 33500, "VEGAN", "HOT", 14],
    ["Chicken Caesar Chaat Bowl", "Charred chicken, lettuce, croutons and cumin dressing.", 39500, "NON_VEGETARIAN", "COLD", 12],
    ["Mushroom Barley Bowl", "Roasted mushrooms, barley, greens and herb broth.", 32500, "VEGAN", "HOT", 15],
    ["Dal Tadka Rice Bowl", "Yellow dal, steamed rice, salad and roasted papad.", 26500, "VEGETARIAN", "HOT", 12],
    ["Prawn Coconut Rice Bowl", "Seared prawns, coconut rice and lime pickle.", 46500, "NON_VEGETARIAN", "HOT", 16]
  ]),
  ...expandCategory("Breakfast & Brunch", pexels("20446413"), [
    ["Masala Dosa", "Crisp dosa, potato masala, sambar and coconut chutney.", 22500, "VEGETARIAN", "HOT", 13],
    ["Mysore Masala Dosa", "Spiced red chutney, potato masala and crisp dosa.", 25500, "VEGETARIAN", "HOT", 14],
    ["Idli Sambar", "Steamed idli, lentil sambar and two house chutneys.", 18500, "VEGETARIAN", "HOT", 10],
    ["Medu Vada Plate", "Crisp lentil vada, sambar and coconut chutney.", 19500, "VEGETARIAN", "HOT", 11],
    ["Akki Roti", "Rice flatbread, greens, chutney and seasonal pickle.", 20500, "VEGAN", "HOT", 12],
    ["Egg Bhurji Pav", "Soft scrambled eggs, tomato, onion and toasted pav.", 24500, "NON_VEGETARIAN", "HOT", 11],
    ["Keema Paratha", "Lamb keema-stuffed paratha with yogurt and pickle.", 34500, "NON_VEGETARIAN", "TANDOOR", 16],
    ["Aloo Paratha", "Stuffed whole-wheat paratha, curd and pickle.", 22500, "VEGETARIAN", "TANDOOR", 13],
    ["Poha with Peanuts", "Flattened rice, curry leaf, peanuts and fresh lime.", 16500, "VEGAN", "HOT", 8],
    ["Masala Omelette", "Farm eggs, onion, tomato, chilli and toasted pav.", 21500, "NON_VEGETARIAN", "HOT", 9]
  ]),
  ...expandCategory("Seasonal Signatures", pexels("28675074"), [
    ["Smoked Pumpkin Korma", "Roasted pumpkin, cashew korma and crisp curry leaf.", 39500, "VEGETARIAN", "HOT", 16, true],
    ["Charred Cauliflower Kadai", "Fire-roasted cauliflower, tomato, pepper and coriander.", 37500, "VEGAN", "HOT", 15],
    ["Tandoori Bhatti Corn", "Charred corn, kasundi butter, lime and chaat masala.", 29500, "VEGETARIAN", "TANDOOR", 10],
    ["Guntur Pepper Prawns", "Seared prawns, Guntur chilli, black pepper and lime.", 58500, "NON_VEGETARIAN", "HOT", 18, true],
    ["Lamb Nihari Pot", "Slow-cooked lamb shank, ginger, marrow and warm spices.", 62500, "NON_VEGETARIAN", "HOT", 28],
    ["Kashmiri Morel Pulao", "Aromatic basmati, morels, saffron and toasted nuts.", 47500, "VEGETARIAN", "HOT", 18],
    ["Burrata Chaat", "Creamy burrata, roasted tomatoes, sev and tamarind.", 38500, "VEGETARIAN", "COLD", 10],
    ["Dates and Cashew Kebab", "Soft dates, cashew, cardamom and a chilli-lime glaze.", 33500, "VEGAN", "TANDOOR", 12]
  ]),
  ...expandCategory("For the Table", pexels("33430556"), [
    ["Ember Vegetarian Grill", "Paneer, broccoli, mushroom and peppers with three chutneys.", 99500, "VEGETARIAN", "TANDOOR", 22, true],
    ["Coastal Fire Grill", "Fish tikka, prawns, coconut sambal and charred lemon.", 139500, "NON_VEGETARIAN", "TANDOOR", 25, true],
    ["Tandoor Tasting Board", "Chicken tikka, fish tikka, naan, pickles and mint chutney.", 129500, "NON_VEGETARIAN", "TANDOOR", 24],
    ["Vegetarian Curry Night", "Dal makhani, palak paneer, jeera rice, naan and salad.", 119500, "VEGETARIAN", "HOT", 22],
    ["Curry Night for Two", "Malabar prawn curry, dal, rice, naan and a cooler.", 149500, "NON_VEGETARIAN", "HOT", 24],
    ["Chaat and Cooler Spread", "Papdi chaat, dahi puri, kale chana chaat and two coolers.", 79500, "VEGETARIAN", "COLD", 15],
    ["Biryani Feast", "Chicken biryani, jackfruit dum biryani, raita and salad.", 169500, "NON_VEGETARIAN", "HOT", 26],
    ["Sweet Finish Sharing Plate", "Kulfi, phirni, gulab jamun and pistachio rabri.", 79500, "VEGETARIAN", "COLD", 12]
  ]),
  ...expandCategory("Chai & Coffee", pexels("17200460"), [
    ["Masala Chai", "Slow-brewed Assam tea, ginger, cardamom and milk.", 12000, "VEGETARIAN", "BAR", 5],
    ["Ginger Jaggery Chai", "Fresh ginger, dark jaggery and warming spices.", 13500, "VEGETARIAN", "BAR", 5],
    ["South Indian Filter Coffee", "Dark roast coffee, chicory and steamed milk.", 15500, "VEGETARIAN", "BAR", 5],
    ["Saffron Cappuccino", "Espresso, saffron milk foam and a pistachio dusting.", 22500, "VEGETARIAN", "BAR", 6],
    ["Cold Brew Chai", "Overnight-spiced tea, oat milk and jaggery foam.", 21500, "VEGAN", "BAR", 4],
    ["Cardamom Affogato", "Vanilla kulfi, espresso and green cardamom.", 28500, "VEGETARIAN", "COLD", 5],
    ["Rose Espresso Tonic", "Espresso, rose, citrus and chilled tonic.", 24500, "VEGAN", "BAR", 4],
    ["Hot Chocolate", "Single-origin chocolate, milk and salted cashew cream.", 23500, "VEGETARIAN", "BAR", 6]
  ])
];
