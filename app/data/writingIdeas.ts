/**
 * Writing Ideas Data
 *
 * Collection of 300 diverse page title ideas with corresponding
 * placeholder text to help users overcome the blank page problem.
 */

export interface WritingIdea {
  title: string;
  placeholder: string;
}

export const writingIdeas: WritingIdea[] = [
  // Food & Dining
  { title: "Coffee Shops", placeholder: "Write about your favorite coffee shops..." },
  { title: "Pizza Places", placeholder: "Share the best pizza spots you've discovered..." },
  { title: "Breakfast Spots", placeholder: "List your go-to places for breakfast..." },
  { title: "Food Trucks", placeholder: "Document the best food trucks in your area..." },
  { title: "Bakeries", placeholder: "Write about bakeries with the best pastries..." },
  { title: "Ice Cream Shops", placeholder: "Share your favorite ice cream destinations..." },
  { title: "Restaurants", placeholder: "List restaurants you'd recommend to others..." },
  { title: "Cooking Tips", placeholder: "Share your best cooking advice and techniques..." },
  { title: "Recipes", placeholder: "Document your favorite recipes and cooking methods..." },
  { title: "Kitchen Gadgets", placeholder: "Review useful kitchen tools and appliances..." },

  // Travel & Places
  { title: "Travel Destinations", placeholder: "Write about places you want to visit..." },
  { title: "Hidden Gems", placeholder: "Share lesser-known places worth discovering..." },
  { title: "National Parks", placeholder: "Document your experiences in national parks..." },
  { title: "City Guides", placeholder: "Create guides for cities you know well..." },
  { title: "Road Trips", placeholder: "Plan or document memorable road trip routes..." },
  { title: "Beaches", placeholder: "List the best beaches you've visited..." },
  { title: "Museums", placeholder: "Write about museums worth visiting..." },
  { title: "Hiking Trails", placeholder: "Share your favorite hiking spots and trails..." },
  { title: "Local Attractions", placeholder: "Document interesting places in your area..." },
  { title: "Weekend Getaways", placeholder: "Plan short trips and mini-vacations..." },

  // Entertainment & Media
  { title: "Movies", placeholder: "List movies you'd recommend to others..." },
  { title: "TV Shows", placeholder: "Write about shows you've enjoyed watching..." },
  { title: "Books", placeholder: "Share books that have made an impact on you..." },
  { title: "Podcasts", placeholder: "Recommend podcasts worth listening to..." },
  { title: "Music Albums", placeholder: "Document albums that define your taste..." },
  { title: "Video Games", placeholder: "Write about games you've enjoyed playing..." },
  { title: "Board Games", placeholder: "List board games perfect for game nights..." },
  { title: "Documentaries", placeholder: "Share documentaries that taught you something..." },
  { title: "Concerts", placeholder: "Document memorable live music experiences..." },
  { title: "Art Galleries", placeholder: "Write about art exhibitions you've enjoyed..." },

  // Lifestyle & Personal
  { title: "Daily Routines", placeholder: "Share routines that work well for you..." },
  { title: "Productivity Tips", placeholder: "Write about methods that boost your productivity..." },
  { title: "Life Lessons", placeholder: "Document important lessons you've learned..." },
  { title: "Goals", placeholder: "Write about your aspirations and objectives..." },
  { title: "Habits", placeholder: "Share habits that have improved your life..." },
  { title: "Morning Rituals", placeholder: "Describe how you start your day..." },
  { title: "Self Care", placeholder: "Write about ways you take care of yourself..." },
  { title: "Mindfulness", placeholder: "Share practices that help you stay present..." },
  { title: "Gratitude", placeholder: "List things you're grateful for..." },
  { title: "Memories", placeholder: "Document meaningful moments from your life..." },

  // Hobbies & Interests
  { title: "Photography", placeholder: "Share your photography tips and experiences..." },
  { title: "Gardening", placeholder: "Write about plants and gardening techniques..." },
  { title: "Crafts", placeholder: "Document your creative projects and ideas..." },
  { title: "Sports", placeholder: "Write about sports you enjoy playing or watching..." },
  { title: "Fitness", placeholder: "Share your workout routines and fitness tips..." },
  { title: "Yoga", placeholder: "Document your yoga practice and favorite poses..." },
  { title: "Running", placeholder: "Write about your running experiences and routes..." },
  { title: "Cycling", placeholder: "Share your favorite bike routes and cycling tips..." },
  { title: "Swimming", placeholder: "Document your swimming experiences and techniques..." },
  { title: "Dancing", placeholder: "Write about dance styles you enjoy..." },

  // Technology & Tools
  { title: "Apps", placeholder: "List apps that make your life easier..." },
  { title: "Websites", placeholder: "Share useful websites you've discovered..." },
  { title: "Software", placeholder: "Write about software tools you recommend..." },
  { title: "Gadgets", placeholder: "Review tech gadgets you find useful..." },
  { title: "Online Tools", placeholder: "Document helpful online resources..." },
  { title: "Productivity Apps", placeholder: "Share apps that boost your productivity..." },
  { title: "Learning Platforms", placeholder: "Write about online learning resources..." },
  { title: "Tech Tips", placeholder: "Share technology tips and tricks..." },
  { title: "Digital Tools", placeholder: "List digital tools that simplify tasks..." },
  { title: "Browser Extensions", placeholder: "Recommend useful browser add-ons..." },

  // Shopping & Products
  { title: "Products", placeholder: "Write about products you'd recommend..." },
  { title: "Brands", placeholder: "Share brands you trust and support..." },
  { title: "Shopping Lists", placeholder: "Create lists for different shopping needs..." },
  { title: "Gift Ideas", placeholder: "Suggest gifts for different occasions..." },
  { title: "Budget Finds", placeholder: "Share great products that don't cost much..." },
  { title: "Quality Items", placeholder: "Write about products built to last..." },
  { title: "Online Stores", placeholder: "List your favorite places to shop online..." },
  { title: "Local Shops", placeholder: "Document great local businesses to support..." },
  { title: "Seasonal Items", placeholder: "Write about products perfect for each season..." },
  { title: "Home Goods", placeholder: "Share items that make your home better..." },

  // Learning & Education
  { title: "Skills", placeholder: "Write about skills you want to develop..." },
  { title: "Courses", placeholder: "Share educational courses you've taken..." },
  { title: "Languages", placeholder: "Document your language learning journey..." },
  { title: "Tutorials", placeholder: "Create step-by-step guides for others..." },
  { title: "Study Tips", placeholder: "Share effective learning strategies..." },
  { title: "Online Classes", placeholder: "Review online courses you've completed..." },
  { title: "Workshops", placeholder: "Write about workshops you've attended..." },
  { title: "Certifications", placeholder: "Document professional certifications..." },
  { title: "Learning Resources", placeholder: "List helpful educational materials..." },
  { title: "Mentors", placeholder: "Write about people who've taught you..." },

  // Health & Wellness
  { title: "Healthy Recipes", placeholder: "Share nutritious meals you enjoy..." },
  { title: "Workout Routines", placeholder: "Document exercise routines that work..." },
  { title: "Mental Health", placeholder: "Write about maintaining emotional wellness..." },
  { title: "Sleep Tips", placeholder: "Share strategies for better sleep..." },
  { title: "Stress Relief", placeholder: "Document ways to manage stress..." },
  { title: "Meditation", placeholder: "Write about your meditation practice..." },
  { title: "Nutrition", placeholder: "Share what you've learned about healthy eating..." },
  { title: "Supplements", placeholder: "Write about supplements you find helpful..." },
  { title: "Doctors", placeholder: "List healthcare providers you recommend..." },
  { title: "Wellness Practices", placeholder: "Share practices that improve your wellbeing..." },

  // Work & Career
  { title: "Career Advice", placeholder: "Share professional insights and tips..." },
  { title: "Job Search", placeholder: "Document your job hunting strategies..." },
  { title: "Networking", placeholder: "Write about building professional relationships..." },
  { title: "Skills Development", placeholder: "Share how you've grown professionally..." },
  { title: "Work Tools", placeholder: "List tools that make work more efficient..." },
  { title: "Industry Trends", placeholder: "Write about changes in your field..." },
  { title: "Professional Goals", placeholder: "Document your career aspirations..." },
  { title: "Workplace Tips", placeholder: "Share advice for succeeding at work..." },
  { title: "Side Projects", placeholder: "Write about projects outside your main job..." },
  { title: "Conferences", placeholder: "Document professional events you've attended..." },

  // Home & Living
  { title: "Home Organization", placeholder: "Share tips for keeping your space tidy..." },
  { title: "Interior Design", placeholder: "Write about decorating your living space..." },
  { title: "Cleaning Tips", placeholder: "Document effective cleaning strategies..." },
  { title: "Home Improvement", placeholder: "Share DIY projects and renovations..." },
  { title: "Furniture", placeholder: "Write about furniture pieces you love..." },
  { title: "Storage Solutions", placeholder: "Share clever ways to organize belongings..." },
  { title: "Decor Ideas", placeholder: "Document decorating inspiration and tips..." },
  { title: "Plants", placeholder: "Write about houseplants and indoor gardening..." },
  { title: "Lighting", placeholder: "Share ideas for improving home lighting..." },
  { title: "Color Schemes", placeholder: "Document color combinations that work..." },

  // Relationships & Social
  { title: "Friendship", placeholder: "Write about maintaining meaningful friendships..." },
  { title: "Family", placeholder: "Share thoughts about family relationships..." },
  { title: "Communication", placeholder: "Document effective communication strategies..." },
  { title: "Social Events", placeholder: "Write about gatherings and celebrations..." },
  { title: "Date Ideas", placeholder: "Share creative ideas for spending time together..." },
  { title: "Community", placeholder: "Write about your local community involvement..." },
  { title: "Volunteering", placeholder: "Document your volunteer experiences..." },
  { title: "Mentorship", placeholder: "Share experiences with mentoring others..." },
  { title: "Networking Events", placeholder: "Write about professional social gatherings..." },
  { title: "Social Skills", placeholder: "Share tips for better social interactions..." },

  // Creative & Artistic
  { title: "Art Projects", placeholder: "Document your creative endeavors..." },
  { title: "Writing", placeholder: "Share your thoughts on the writing process..." },
  { title: "Music", placeholder: "Write about music that inspires you..." },
  { title: "Drawing", placeholder: "Document your drawing practice and progress..." },
  { title: "Painting", placeholder: "Share your painting experiences and techniques..." },
  { title: "Crafting", placeholder: "Write about DIY projects and handmade items..." },
  { title: "Design", placeholder: "Document your design process and inspiration..." },
  { title: "Creative Process", placeholder: "Share how you approach creative work..." },
  { title: "Inspiration", placeholder: "Write about what sparks your creativity..." },
  { title: "Art Supplies", placeholder: "List art materials you recommend..." },

  // Nature & Environment
  { title: "Wildlife", placeholder: "Write about animals you've observed..." },
  { title: "Weather", placeholder: "Document interesting weather patterns..." },
  { title: "Seasons", placeholder: "Share what you love about each season..." },
  { title: "Outdoor Activities", placeholder: "Write about activities you enjoy outside..." },
  { title: "Conservation", placeholder: "Share environmental protection ideas..." },
  { title: "Sustainability", placeholder: "Document eco-friendly practices..." },
  { title: "Climate", placeholder: "Write about climate observations and changes..." },
  { title: "Natural Phenomena", placeholder: "Document interesting natural events..." },
  { title: "Ecosystems", placeholder: "Write about different natural environments..." },
  { title: "Environmental Tips", placeholder: "Share ways to live more sustainably..." },

  // Transportation & Vehicles
  { title: "Cars", placeholder: "Write about vehicles you've owned or admired..." },
  { title: "Public Transportation", placeholder: "Share experiences with buses, trains, etc..." },
  { title: "Bicycles", placeholder: "Document your cycling experiences..." },
  { title: "Walking", placeholder: "Write about walking routes and experiences..." },
  { title: "Travel Methods", placeholder: "Compare different ways to get around..." },
  { title: "Commuting", placeholder: "Share tips for daily travel to work..." },
  { title: "Road Trips", placeholder: "Document memorable driving adventures..." },
  { title: "Parking", placeholder: "Write about parking strategies and spots..." },
  { title: "Traffic", placeholder: "Share observations about traffic patterns..." },
  { title: "Transportation Apps", placeholder: "Review apps that help with travel..." },

  // Finance & Money
  { title: "Budgeting", placeholder: "Share strategies for managing money..." },
  { title: "Saving Tips", placeholder: "Write about ways to save money..." },
  { title: "Investments", placeholder: "Document your investment learning journey..." },
  { title: "Financial Goals", placeholder: "Write about your money-related objectives..." },
  { title: "Frugal Living", placeholder: "Share tips for living on less..." },
  { title: "Side Income", placeholder: "Document ways to earn extra money..." },
  { title: "Financial Apps", placeholder: "Review apps that help with money management..." },
  { title: "Banking", placeholder: "Write about banking experiences and tips..." },
  { title: "Credit", placeholder: "Share what you've learned about credit..." },
  { title: "Debt Management", placeholder: "Document strategies for paying off debt..." },

  // Seasonal & Holidays
  { title: "Holiday Traditions", placeholder: "Write about celebrations you enjoy..." },
  { title: "Seasonal Activities", placeholder: "Share activities perfect for each season..." },
  { title: "Gift Giving", placeholder: "Document thoughtful gift ideas..." },
  { title: "Decorations", placeholder: "Write about holiday and seasonal decorating..." },
  { title: "Celebrations", placeholder: "Share memorable celebration experiences..." },
  { title: "Festivals", placeholder: "Document festivals and events you've attended..." },
  { title: "Cultural Events", placeholder: "Write about cultural celebrations..." },
  { title: "Party Planning", placeholder: "Share tips for organizing gatherings..." },
  { title: "Special Occasions", placeholder: "Document meaningful moments and milestones..." },
  { title: "Traditions", placeholder: "Write about customs you value..." },

  // Random & Miscellaneous
  { title: "Life Hacks", placeholder: "Share clever shortcuts and tips..." },
  { title: "Random Thoughts", placeholder: "Write about whatever's on your mind..." },
  { title: "Observations", placeholder: "Document interesting things you've noticed..." },
  { title: "Questions", placeholder: "Write about things you're curious about..." },
  { title: "Predictions", placeholder: "Share your thoughts about the future..." },
  { title: "Comparisons", placeholder: "Compare different options or choices..." },
  { title: "Rankings", placeholder: "Create ordered lists of your preferences..." },
  { title: "Pros and Cons", placeholder: "Weigh the advantages and disadvantages..." },
  { title: "Before and After", placeholder: "Document changes and transformations..." },
  { title: "Lessons Learned", placeholder: "Share wisdom gained from experience..." },

  // Collections & Lists
  { title: "Bucket List", placeholder: "Write about things you want to do..." },
  { title: "Wish List", placeholder: "Document things you hope to have..." },
  { title: "Favorites", placeholder: "List your favorite things in any category..." },
  { title: "Recommendations", placeholder: "Share things you'd suggest to others..." },
  { title: "Must-Haves", placeholder: "Write about essential items or experiences..." },
  { title: "Top 10", placeholder: "Create a ranked list of your top choices..." },
  { title: "Collections", placeholder: "Document things you collect or gather..." },
  { title: "Discoveries", placeholder: "Share new things you've found..." },
  { title: "Hidden Treasures", placeholder: "Write about unexpected finds..." },
  { title: "Best Of", placeholder: "List the best examples in any category..." },

  // Prepping & Self-Sufficiency
  { title: "Emergency Kit", placeholder: "List essential items for emergency preparedness..." },
  { title: "Food Storage", placeholder: "Document long-term food storage strategies..." },
  { title: "Water Purification", placeholder: "Write about water filtration and purification methods..." },
  { title: "Survival Skills", placeholder: "Share basic survival techniques and knowledge..." },
  { title: "Homesteading", placeholder: "Document self-sufficient living practices..." },
  { title: "Gardening Tips", placeholder: "Share advice for growing your own food..." },
  { title: "Canning & Preserving", placeholder: "Write about food preservation techniques..." },
  { title: "Off-Grid Living", placeholder: "Explore living independently from utilities..." },
  { title: "First Aid", placeholder: "Document essential first aid knowledge and supplies..." },
  { title: "Bug Out Bag", placeholder: "List items for emergency evacuation kits..." },

  // Engineering & STEM
  { title: "Programming Languages", placeholder: "Compare different programming languages..." },
  { title: "Engineering Projects", placeholder: "Document interesting engineering solutions..." },
  { title: "Math Concepts", placeholder: "Explain mathematical concepts in simple terms..." },
  { title: "Science Experiments", placeholder: "Share fun and educational science experiments..." },
  { title: "Technology Trends", placeholder: "Write about emerging technologies..." },
  { title: "Coding Tutorials", placeholder: "Create step-by-step programming guides..." },
  { title: "Physics Principles", placeholder: "Explain physics concepts with real-world examples..." },
  { title: "Chemistry Basics", placeholder: "Document fundamental chemistry knowledge..." },
  { title: "Biology Facts", placeholder: "Share interesting biological discoveries..." },
  { title: "Space Exploration", placeholder: "Write about space missions and discoveries..." },

  // Studies & Learning
  { title: "Study Methods", placeholder: "Share effective learning and study techniques..." },
  { title: "Note Taking", placeholder: "Document different note-taking strategies..." },
  { title: "Memory Techniques", placeholder: "Write about methods to improve memory..." },
  { title: "Research Skills", placeholder: "Share tips for effective research and fact-finding..." },
  { title: "Time Management", placeholder: "Document strategies for managing study time..." },
  { title: "Online Courses", placeholder: "Review and recommend online learning platforms..." },
  { title: "Language Learning", placeholder: "Share tips for learning new languages..." },
  { title: "Academic Writing", placeholder: "Write about effective academic writing techniques..." },
  { title: "Test Preparation", placeholder: "Document strategies for exam preparation..." },
  { title: "Learning Resources", placeholder: "List valuable educational resources and tools..." },

  // Logic & Critical Thinking
  { title: "Problem Solving", placeholder: "Share systematic approaches to solving problems..." },
  { title: "Logical Fallacies", placeholder: "Document common logical errors and how to avoid them..." },
  { title: "Decision Making", placeholder: "Write about frameworks for making better decisions..." },
  { title: "Critical Analysis", placeholder: "Share methods for analyzing information critically..." },
  { title: "Debate Techniques", placeholder: "Document effective argumentation strategies..." },
  { title: "Reasoning Skills", placeholder: "Write about developing logical reasoning abilities..." },
  { title: "Cognitive Biases", placeholder: "Explore common thinking biases and their effects..." },
  { title: "Philosophy Basics", placeholder: "Introduce fundamental philosophical concepts..." },
  { title: "Ethics Questions", placeholder: "Explore moral and ethical dilemmas..." },
  { title: "Mind Puzzles", placeholder: "Share challenging logic puzzles and brain teasers..." },

  // School & Academic Notes
  { title: "Class Notes", placeholder: "Organize and share your academic notes..." },
  { title: "Lecture Summaries", placeholder: "Summarize key points from lectures..." },
  { title: "Study Guides", placeholder: "Create comprehensive study guides for subjects..." },
  { title: "Assignment Tips", placeholder: "Share strategies for completing assignments..." },
  { title: "Group Projects", placeholder: "Document effective collaboration techniques..." },
  { title: "Professor Reviews", placeholder: "Write about instructors and their teaching styles..." },
  { title: "Course Recommendations", placeholder: "Recommend valuable courses and subjects..." },
  { title: "Campus Life", placeholder: "Share experiences and tips about school life..." },
  { title: "Study Spaces", placeholder: "Review the best places to study on campus..." },
  { title: "Academic Resources", placeholder: "List helpful academic tools and resources..." },

  // Journalism & Media
  { title: "News Analysis", placeholder: "Analyze current events and their implications..." },
  { title: "Interview Techniques", placeholder: "Share effective interviewing strategies..." },
  { title: "Media Literacy", placeholder: "Write about evaluating news sources and bias..." },
  { title: "Fact Checking", placeholder: "Document methods for verifying information..." },
  { title: "Writing Style", placeholder: "Explore different journalistic writing approaches..." },
  { title: "Press Freedom", placeholder: "Discuss the importance of free press..." },
  { title: "Local News", placeholder: "Cover stories and events in your community..." },
  { title: "Investigative Tips", placeholder: "Share research techniques for deep reporting..." },
  { title: "Ethics in Media", placeholder: "Explore ethical considerations in journalism..." },
  { title: "Digital Journalism", placeholder: "Write about online media and its evolution..." },

  // Favorite Podcasts
  { title: "True Crime Podcasts", placeholder: "Recommend the best true crime shows..." },
  { title: "Comedy Podcasts", placeholder: "Share podcasts that make you laugh..." },
  { title: "Educational Podcasts", placeholder: "List podcasts that teach you something new..." },
  { title: "Interview Podcasts", placeholder: "Recommend shows with great conversations..." },
  { title: "News Podcasts", placeholder: "Share reliable sources for current events..." },
  { title: "Science Podcasts", placeholder: "List podcasts about scientific discoveries..." },
  { title: "History Podcasts", placeholder: "Recommend shows about historical events..." },
  { title: "Business Podcasts", placeholder: "Share podcasts about entrepreneurship and business..." },
  { title: "Technology Podcasts", placeholder: "List shows about tech trends and innovation..." },
  { title: "Storytelling Podcasts", placeholder: "Recommend narrative and story-driven shows..." },

  // Politics & Governance
  { title: "Political Systems", placeholder: "Compare different forms of government..." },
  { title: "Voting Guide", placeholder: "Create guides for elections and ballot measures..." },
  { title: "Policy Analysis", placeholder: "Analyze the impact of government policies..." },
  { title: "Civic Engagement", placeholder: "Write about ways to participate in democracy..." },
  { title: "Political History", placeholder: "Document important political events and movements..." },
  { title: "Local Government", placeholder: "Explain how local politics affects daily life..." },
  { title: "International Relations", placeholder: "Explore relationships between countries..." },
  { title: "Constitutional Rights", placeholder: "Write about fundamental rights and freedoms..." },
  { title: "Political Movements", placeholder: "Document social and political movements..." },
  { title: "Election Process", placeholder: "Explain how elections work in your country..." },

  // Countries & Cultures
  { title: "Country Profiles", placeholder: "Write detailed profiles of different countries..." },
  { title: "Cultural Traditions", placeholder: "Document unique cultural practices and customs..." },
  { title: "Language Diversity", placeholder: "Explore the languages spoken around the world..." },
  { title: "Historical Sites", placeholder: "Write about important historical landmarks..." },
  { title: "World Cuisines", placeholder: "Explore traditional foods from different cultures..." },
  { title: "Festivals & Holidays", placeholder: "Document celebrations from around the world..." },
  { title: "Geography Facts", placeholder: "Share interesting geographical information..." },
  { title: "Cultural Exchange", placeholder: "Write about cross-cultural experiences..." },
  { title: "World Religions", placeholder: "Explore different religious beliefs and practices..." },
  { title: "Global Issues", placeholder: "Discuss challenges facing the world today..." },

  // Additional Categories
  { title: "Climate Change", placeholder: "Write about environmental challenges and solutions..." },
  { title: "Renewable Energy", placeholder: "Explore sustainable energy sources and technologies..." },
  { title: "Urban Planning", placeholder: "Discuss city design and development strategies..." },
  { title: "Transportation", placeholder: "Write about different modes of transportation..." },
  { title: "Architecture", placeholder: "Explore building design and architectural styles..." },
  { title: "Art History", placeholder: "Document important art movements and artists..." },
  { title: "Music Theory", placeholder: "Explain musical concepts and composition..." },
  { title: "Photography", placeholder: "Share photography techniques and tips..." },
  { title: "Film Making", placeholder: "Write about video production and cinematography..." },
  { title: "Creative Writing", placeholder: "Share storytelling techniques and writing prompts..." },
  { title: "Public Speaking", placeholder: "Document effective presentation and speaking skills..." },
  { title: "Leadership", placeholder: "Write about leadership principles and practices..." },
  { title: "Team Building", placeholder: "Share strategies for effective teamwork..." },
  { title: "Conflict Resolution", placeholder: "Document methods for resolving disputes..." },
  { title: "Negotiation", placeholder: "Write about effective negotiation techniques..." },
  { title: "Project Management", placeholder: "Share project planning and execution strategies..." },
  { title: "Innovation", placeholder: "Explore creative problem-solving and invention..." },
  { title: "Entrepreneurship", placeholder: "Write about starting and running businesses..." },
  { title: "Financial Literacy", placeholder: "Share personal finance and money management tips..." },
  { title: "Career Development", placeholder: "Document strategies for professional growth..." }
];

// Helper function to get suggestions in batches
export function getSuggestionsBatch(startIndex: number, batchSize: number = 50): WritingSuggestion[] {
  return writingSuggestions.slice(startIndex, startIndex + batchSize);
}

// Helper function to get total count
export function getTotalSuggestionsCount(): number {
  return writingSuggestions.length;
}
