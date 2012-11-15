// Aliases for the rather verbose methods on ES5
var descriptor  = Object.getOwnPropertyDescriptor
  , properties  = Object.getOwnPropertyNames
  , define_prop = Object.defineProperty

// (target:Object, source:Object) → Object
// Copies properties from `source' to `target'
function extend(target, source) {
    properties(source).forEach(function(key) {
        define_prop(target, key, descriptor(source, key)) })

    return target
}

function Schedule() {
	this.units = {
		"Autumn": { "min" : 0, "max" : 0},
		"Winter": { "min" : 0, "max" : 0},
		"Spring": { "min" : 0, "max" : 0}
	}
	this.courses = {
		"Autumn": [],
		"Winter": [],
		"Spring": []
	}
}

function CourseOffering(id, name, units, term, days, startTime, endTime) {
	this.id = id
	this.name = name
	this.units = units
	this.term = term
	this.days = days
	this.startTime = startTime
	this.endTime = endTime
}

CourseOffering.prototype.fitsIn = function(schedule) {
	return schedule.canAddCourseOffering(this);
};

CourseOffering.prototype.conflictsWith = function(courseOffering) {
	var haveDaysInCommon = !_.isEmpty(_.intersection(courseOffering.days, this.days))
	if (haveDaysInCommon 
		&& ((this.startTime >= courseOffering.startTime && this.startTime < courseOffering.endTime)
			|| (courseOffering.startTime >= this.startTime && courseOffering.startTime < this.endTime))
		)
		return true;
	return false;

};

function Course(obj) {
	extend(this, obj)
}

Course.prototype.getTerms = function() {
	return _.keys(this.terms);
};

Course.prototype.canBePicked = function(scheduleList) {
	var result = false;
	scheduleList.schedules.forEach(function(schedule){
		this.getTerms().forEach(function(term){
			if (this.getOffering(term).fitsIn(schedule)) {
				result =  true;
			};
		}, this)
	}, this)
	return result;
};

Course.prototype.getOffering = function(term) {
	if (_.has(this.terms, term)) {
		return new CourseOffering(
			this.id,
			this.name,
			this.units,
			this.term = term,
			this.terms[term].days,
			this.terms[term].start,
			this.terms[term].end
			)
	};
};

Schedule.prototype.canAddCourseOffering = function(newCourseOffering, constraints) {
	var term = newCourseOffering.term
	for (var i = this.courses[term].length - 1; i >= 0; i--) {
		if(this.courses[term][i].conflictsWith(newCourseOffering)) {
			console.log("conflict")
			return false;
		};
	};
	console.log("no conflict")

	constraints ||= [];
	for (var i = constraints.length - 1; i >= 0; i--) {
		if(!constraints[i].isSatisfiedBy(this.courses[term].concat([newCourseOffering]))) { 
			console.log("constraint not satisfied");
			return false;
		}
	};

	console.log("no constraints violated")
	return true;
};

Schedule.prototype.add = function(courseOffering) {
	var term = courseOffering.term
	this.courses[term].push(courseOffering)
	this.units[term].min += courseOffering.units.min
	this.units[term].max += courseOffering.units.max
};

Schedule.prototype.remove = function(courseOffering) {
	var term = courseOffering.term
	this.courses.term = this.courses.term.filter (function(offering){
		return offering.id !== courseOffering.id
	})
};

Schedule.prototype.removeByID = function(id) {
	this.getTerms().forEach(function(term){
		this.courses.term = this.courses.term.filter (function(offering){
			return offering.id !== courseOffering.id
		})
	}, this)
};

Schedule.prototype.getTerms = function() {
	return _.keys(this.courses);
};

Schedule.prototype.getTotalUnits = function(term) {
	if (term) {
		return this.units[term];
	}
	else {
		var res = { "min" : 0, "max" : 0}
		this.getTerms().forEach(function(term_){
			var res_for_term = this.getTotalUnits(term_)
			res.min += res_for_term.min
			res.max += res_for_term.max
		}, this)
		return res;
	}
};

Schedule.prototype.fulfills = function(unitRequirement, constraints) {
//TODO
};

function ScheduleList(courses){
	this.schedules = [new Schedule()]
	this.courses = []

	if (courses) {
		courses.forEach(function(course){
			this.add(course);
		}, this)
	};
}

ScheduleList.prototype.getScheduleCount = function() {
	return this.schedules.length
};

ScheduleList.prototype.canPick = function(course) {
	return course.canBePicked(this)
};

ScheduleList.prototype.add = function(course) {
	var newSchedules = []
	while (!_.isEmpty(this.schedules)){
		var schedule = this.schedules.pop();
		course.getTerms().forEach(function(term){
			var courseOffering = course.getOffering(term);
			if (schedule.canAddCourseOffering(courseOffering)) {
				var newSchedule = jQuery.extend(true, new Schedule, schedule);
				newSchedule.add(courseOffering);
				newSchedules.push(newSchedule);
			};
		});
	}
	if (!_.isEmpty(newSchedules)) {
		this.courses.push(course);
	};
	this.schedules = newSchedules
	console.log(newSchedules.length)
};

ScheduleList.prototype.remove = function(course) {
	// this.schedules.forEach(function(schedule){
	// 	schedule.removeByID(course.id);
	// })
	this.courses = this.courses.filter(function(course_){
		return course_.id !== course.id;
	})
	this.schedules = new ScheduleList(this.courses).schedules;
};

ScheduleList.prototype.fulfills = function(requirement, constraints) {
	if (this.courseCount > 0) {
		if(_.intersection(this.courses, requirement.courseList).length < this.courseCount)
			return false;
		else
			return true;
	}
	if (this.unitCount > 0) {
		//TODO
		constraints ||= [new Constraint()];
		var maxUnitsPerTerm = contraint.maxUnitsPerTerm;
		for (var i = this.schedules.length - 1; i >= 0; i--) {
			var schedule = this.schedules[i];
			if (schedule.fulfills(requirement, constraints))
				return true;
		};
		return false;
	};
};

/*
	Requirement types:
	- Number of courses from a list: Foundations, A, B, sometimes C
	- Number of units: Depth (27) and Breadth (9), 45 total units
*/
function Requirement(name, courseCount, unitCount, courseList){
	this.name = name;
	this.requiredCourseCount = courseCount || 0;
	this.requiredUnitCount = unitCount || 0;
	this.courseList = courseList;
}

function CourseRequirement(name, courseCount, courseList){
	Requirement.call(this, name, courseCount, 0, courseList);
}

function UnitRequirement(name, unitCount, courseList){
	Requirement.call(this, name, 0, unitCount, courseList);
}


function Constraint(maxUnitsPerTerm, maxDaysPerTerm){
	this.maxUnitsPerTerm = maxUnitsPerTerm || 18;
	this.maxDaysPerTerm = maxDaysPerTerm || 5;
}

Constraint.prototype.isSatisfiedBy = function(courseOfferings) {
	if (this.maxUnitsPerTerm > 0) {
		var minSum = 0
		for (var i = courseOfferings.length - 1; i >= 0; i--) {
			minSum += courseOfferings[i].units.min;
		};
		return minSum <= this.maxDaysPerTerm;
	};

	if (this.maxDaysPerTerm < 5) {
		var unionDays = [];
		for (var i = courseOfferings.length - 1; i >= 0; i--) {
			unionDays = _.union(unionDays, courseOfferings[i].days);
		};
		return unionDays.length <= maxDaysPerTerm;
	};
};


var foundations = {
	"required" : 5,
	"courses" : [
		{
				"id" : "CS103",
				"name" : "Mathematical Foundations of Computing",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Autumn" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1415,
						"end" : 1530
					},
					"Winter" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1250,
						"end" : 1405
					},
					"Spring" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1250,
						"end" : 1405
					}
				}
			},
			{
				"id" : "CS107",
				"name" : "Computer Organization and Systems",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Autumn" : {
						"days" : ["Mon", "Fri"],
						"start" : 1100,
						"end" : 1215
					},
					"Winter" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1000,
						"end" : 1050
					},
					"Spring" : {
						"days" : ["Mon", "Fri"],
						"start" : 1100,
						"end" : 1215
					}
				}
			},
			{
				"id" : "CS109",
				"name" : "Introduction to Probability for Computer Scientists",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Winter" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1250,
						"end" : 1415
					},
					"Spring" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1250,
						"end" : 1415
					}
				}
			},
			{
				"id" : "CS110",
				"name" : "Principles of Computer Systems",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Autumn" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1100,
						"end" : 1150
					},
					"Winter" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1100,
						"end" : 1150
					},
					"Spring" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1000,
						"end" : 1050
					}
				}
			},
			{
				"id" : "CS161",
				"name" : "Design and Analysis of Algorithms",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Autumn" : {
						"days" : ["Tue", "Thu"],
						"start" : 1100,
						"end" : 1215
					},
					"Spring" : {
						"days" : ["Mon", "Wed"],
						"start" : 1615,
						"end" : 1730
					}
				}
			}
	]
}

var scheduleList = new ScheduleList();

var foundationCourses = foundations.courses.map(function(course){
	return new Course(course);
})

// console.log(myCourse.canBePicked(scheduleList))
// scheduleList.add(myCourse)
console.log(scheduleList)


