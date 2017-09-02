const http = require('http');
const parser = require('xml2json');
const moment = require('moment');
const fs = require('fs');
const key = require('./key');

const host = 'www.goodreads.com';
const apiPath = '/review/list?key='+key.key+'&v=2&id=10567634&shelf=<shelf>&per_page=50&page=<page>&sort=date_updated&order=d';
const currentlyReadingShelfName = 'currently-reading';
const readShelfName = 'read';

const start = async () => {
	const readBooks = await getReadBooks();
	const currentlyReadingBooks = await getCurrentlyReadingBooks();
	createMarkDown(currentlyReadingBooks, readBooks);
}

const createMarkDown = (currentlyReadingBooks, readBooks) => {
	var stream = fs.createWriteStream("./reading_list.md");
	stream.once('open', function(fd) {
		writeCurrentlyReadingBooks(currentlyReadingBooks, stream);
		writeReadBooks(readBooks, stream);		
		stream.end();
	});	
}

const writeCurrentlyReadingBooks = (currentlyReadingBooks, stream) => {
	stream.write("## Currently Reading\n");
	currentlyReadingBooks.forEach(function(book, index){
		stream.write(`${index + 1 }. [${book.title}](${book.link})\n`);
	});
	stream.write('\n');
}

const writeReadBooks = (readBooks, stream) => {
	var years = Object.getOwnPropertyNames(readBooks);
	years.sort(function(year1, year2){
		return +year2 - +year1;
	});
	years.forEach(function(year){
		stream.write(`## ${year}\n`);
		var books = readBooks[year];
		books.forEach(function(book, index){
			stream.write(`${index + 1 }. [${book.title}](${book.link})\n`);
		});
		stream.write('\n');
	});
}

const getReadBooks = async () => {
	const books = await getData(readShelfName);
	var dateObj = {};
	books.forEach(function(review){
		var date_updated = review.date_updated,
		book = review.book,
		year = moment(date_updated, "ddd MMM DD HH:mm:ss Z YYYY").year(),
		booksByYear = dateObj[year] || [];
		booksByYear.push({title: book.title, link: book.link});
		dateObj[year] = booksByYear;
	});
	return dateObj;
}

const getCurrentlyReadingBooks = async () => {
	var books = [];
	const data = await getData(currentlyReadingShelfName);
	data.forEach(function(review){
		var book = review.book;
		books.push({title: book.title, link: book.link});
	});
	return books;
}

const getData = async (shelf) => {
	var data = [],
	page = 1,
	end = -1,
	total = 0;

	do {
		var response = await getDataForPage(shelf, page++);
		var review = response.reviews.review;
		if(Array.isArray(review)) {
			Array.prototype.push.apply(data, review);	
		}
		else {
			data.push(review);
		}
		total = response.reviews.total;
		end = response.reviews.end;
	} while(end < total);

	return data;

}

function getDataForPage(shelf, page){
	var path = apiPath.replace('<shelf>', shelf).replace('<page>', page);
	var options = {
		host: host,
		path: path
	};
	return sendRequest(options);
}

function sendRequest(options){
	var promise = new Promise(function(fulfill, reject){
		http.request(options, function(response){
			var str = '';
			response.on('data', function (chunk) {
				str += chunk;
			});
			response.on('end', function () {
				var json = parser.toJson(str, {object: true});
				fulfill(json.GoodreadsResponse);
			});
		}).end();
	});
	return promise;
}

start();
