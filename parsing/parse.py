import xml.dom.minidom as minidom
import urllib2
import time
import string
import urllib
import json

def get(elem, field, throw = False, default = ''):
	res = elem.getElementsByTagName(field)
	if len(res) == 0:
		if throw:
			raise Exception("%s not found" % field)
		return default
	res = res[0].childNodes
	if len(res) == 0:
		if throw:
			raise Exception("%s not found" % field)
		return default
	return res[0].data

def getID(course):
	return get(course, 'subject') + " " + get(course, 'code')

def buildUrl(query, department = None):
	part1 =  "http://explorecourses.stanford.edu/CourseSearch/search?view=xml-20120105&catalog=&page=0&q="
	part2 =  "&filter-catalognumber-"
	part3 = "=on"
	url = part1 + urllib.quote_plus(query)
	if department:
		url += part2 + department + part3
	return url

def allowed(dept, course_id, allowedCourses):
	num = int(''.join([c for c in course_id if c not in string.letters]))
	if dept == 'CS' and (num > 110 or course_id in ['103', '107', '109', '110']):
		return True
	if (dept + " " + course_id) in allowedCourses:
		return True
	return False

def getCoursesForDept(department, allowedCourses):
	url = buildUrl(department, department)
	f = urllib2.urlopen(url)
	doc = minidom.parse(f)
	courses = doc.getElementsByTagName('course')
	allCourses = []

	for course in courses:
		if not allowed(department, get(course, 'code', throw = True), allowedCourses):
			continue
		course_id = getID(course)
		# try:
		name = get(course, 'title', throw = True)
		grading = get(course, 'grading')
		desc = get(course, "description")
		# units = get(course, 'units')
		units_min = int(get(course, 'unitsMin', throw = True))
		units_max = int(get(course, 'unitsMax', throw = True))
		# if units_min == '' and units != '':
		# 	units_min = int(units.split('-')[0])
		# 	units_max = int(units.split('-')[-1])
		units = {'min': units_min, 'max': units_max}

		instructors = []
		for instructor in course.getElementsByTagName("instructor"):
			instructors.append(get(instructor, 'name', throw = True))

		offerings = []

		for section in course.getElementsByTagName("section"):
			section_number = get(section, 'sectionNumber', throw = True)
			if section_number == '01': #this corresponds to actual classes, not discussion sections
				schedules = section.getElementsByTagName('schedule')
				# assert len(schedules) < 2
				for schedule in schedules[:1]:
					try:
						start = time.strptime(get(schedule, 'startTime', throw = True), "%H:%M:%S")
						end = time.strptime(get(schedule, 'endTime', throw = True), "%H:%M:%S")
					except Exception as e:
						print course_id
						raise e
					days = get(schedule, 'days', default = '').split()
					days = [day[:3] for day in days]

					term = get(section, 'term', throw = True)
					period = term.split(' ')[1]
					year = term.split(' ')[0]
					term_id = period + year

					base_year = int(year.split('-')[0])
					next_year = "%d-%d" % (base_year + 1, base_year + 2)
					next_term_id = period + next_year



					offerings.append({
						'start': start.tm_hour * 100 + start.tm_min,
						'end': end.tm_hour * 100 + end.tm_min,
						'days': days,
						'term': {
							'period': period,
							'year': year,
							'id': term_id
						}
					})

					#duplicate for following year
					offerings.append({
						'start': start.tm_hour * 100 + start.tm_min,
						'end': end.tm_hour * 100 + end.tm_min,
						'days': days,
						'term': {
							'period': period,
							'year': next_year,
							'id': next_term_id
						}
					})

		allCourses.append({
			'id': course_id,
			'name': name,
			'grading': grading,
			'desc': desc,
			'units': units,
			'instructors': list(set(instructors)),
			'courseOfferings': offerings
		})
		print "Processed %s" % course_id

	return allCourses

departments = ['ARTSTUDI', 'ENGR', 'SOC', 'SBIO', 'GENE', 'BIOC', 'PSYCH', 'STATS', 'CME', 'MS&E', 'ME', 'COMM', 'EE', 'CS', 'APPPHYS', 'BIOE'];
allCourses = [];

allowedCourses = set()
with open("../allprograms.json") as f:
	programs = json.load(f)
	for program in programs:
		allowedCourses = allowedCourses.union(set(program['breadthCourses']), set(program['depthCourses']))
		# allowedCourses += set(program['depthCourses'])


		

for dept in departments[:]:
	print "Getting courses from %s" % dept
	allCourses += getCoursesForDept(dept, allowedCourses)

filename = "../allcourses.json"
with open(filename, 'wb') as f:
	print "Outputting %d courses as %s" % (len(allCourses), filename)
	f.write(json.dumps(allCourses, indent = 4))

