var http = require("http"),
	xml2js = require("xml2js"),
	async = require('async'),
	log = require('cnlogger').logger(module),
	util = require('util'),
	inspect = require("eyes").inspector();

var parser = new xml2js.Parser();
parser.on('end', function(result) {
  inspect(result);
});

var buildUrl = function(query, department){
	var part1 =  "http://explorecourses.stanford.edu/CourseSearch/search?view=xml-20120105&catalog=&page=0&q=";
	var part2 =  "&filter-catalognumber-";
	var part3 = "=on";
	var url = part1 + encodeURIComponent(query);
	if (department) {
		url += part2 + department + part3;
	};
	return url;
}

var example = {
        "id": "ENGR 209A",
        "name": "Analysis and Control of Nonlinear Systems",
        "desc": "Introduction to nonlinear phenomena: multiple equilibria, limit cycles, bifurcations, complex dynamical behavior. Planar dynamical systems, analysis using phase plane techniques. Describing functions. Lyapunov stability theory. SISO feedback linearization, sliding mode control. Design examples. Prerequisite: 205.",
        "instructors": [
            "Rock,S."
        ],
        "units": {
            "min": 3,
            "max": 3
        },
        "grading": "Letter (ABCD/NP)",
        "terms": [
            {
                "period": "Winter",
                "year": "2012-2013",
                "id": "Winter2012-2013"
            }
        ],
        "courseOfferings": [
            {
                "term": {
                    "period": "Winter",
                    "year": "2012-2013",
                    "id": "Winter2012-2013"
                },
                "days": [
                    "Tue",
                    "Thu"
                ],
                "start": 930,
                "end": 1045
            },
            {
                "term": {
                    "period": "Winter",
                    "year": "2013-2014",
                    "id": "Winter2013-2014"
                },
                "days": [
                    "Tue",
                    "Thu"
                ],
                "start": 930,
                "end": 1045
            }
        ]
    }

var parseXMLdata = function(data, allCourses){
	// log.info("Parsing xml file");
	var courses;
	parser.parseString(data, function(err, result){
		courses = result.xml.courses[0].course;
	});
	console.log(courses)
	for (var i = courses.length - 1; i >= 0; i--) {
		var course = courses[i];
		try {
			allCourses.push({
				id: course.subject[0] + " " + course.code[0],
				name: course.title[0],
				desc: course.description[0],
				grading: course.grading[0]
			});
		}
		catch(e) {
			console.log(util.inspect(course, false, null))
		}
	};
}

var departments = ['ARTSTUDI', 'ENGR', 'SOC', 'SBIO', 'GENE', 'BIOC', 'PSYCH', 'STATS', 'CME', 'MS&E', 'ME', 'COMM', 'EE', 'CS'];
var courses = [];

async.eachSeries(departments.slice(0,1), function(department, callback){
	var url = buildUrl(department, department);
	log.info("Retrieving info for " + department);
	var xml = "";
	http.get(url, function(res){
		res.on('data', function(data){
			xml += data;
		});
		res.on('end', function(e) {
			log.info(xml.substring(0,500));
			parseXMLdata(xml, courses);
			callback();
		});
	}).on('error', function(e) {
	  log.error("Error retrieving info for " + department + " from url: " + url);
	});	
}, function(err){
	log.debug("All courses: " + JSON.stringify(courses));
});


